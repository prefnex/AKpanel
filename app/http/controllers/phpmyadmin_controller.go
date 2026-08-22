package controllers

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	goravelhttp "github.com/goravel/framework/contracts/http"
)

type PhpMyAdminController struct {
	targetBase string
	client     *http.Client
}

func NewPhpMyAdminController() *PhpMyAdminController {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     false,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   50,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		DisableKeepAlives:     false,
	}

	return &PhpMyAdminController{
		targetBase: "http://127.0.0.1:8085",
		client: &http.Client{
			Transport: transport,
			Timeout:   120 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse // Forward 302/301 redirects directly to browser
			},
		},
	}
}

// Hop-by-hop headers to filter out in reverse proxy
var hopByHopHeaders = map[string]bool{
	"Connection":          true,
	"Keep-Alive":          true,
	"Proxy-Authenticate":  true,
	"Proxy-Authorization": true,
	"Te":                  true,
	"Trailers":            true,
	"Transfer-Encoding":   true,
	"Upgrade":             true,
	"Content-Length":      true,
}

// Proxy handles transparent reverse proxying to phpMyAdmin on port 8085 with full session persistence & AJAX stability
func (r *PhpMyAdminController) Proxy(ctx goravelhttp.Context) goravelhttp.Response {
	req := ctx.Request().Origin()

	path := req.URL.Path
	if path == "/phpmyadmin" {
		targetRedirect := "/phpmyadmin/"
		if req.URL.RawQuery != "" {
			targetRedirect += "?" + req.URL.RawQuery
		}
		return ctx.Response().Redirect(301, targetRedirect)
	}

	if !strings.HasPrefix(path, "/phpmyadmin") && !strings.HasPrefix(path, "/themes") && !strings.HasPrefix(path, "/js") {
		if strings.HasPrefix(path, "/") {
			path = "/phpmyadmin" + path
		} else {
			path = "/phpmyadmin/" + path
		}
	}

	targetURL := fmt.Sprintf("%s%s", r.targetBase, path)
	if req.URL.RawQuery != "" {
		targetURL += "?" + req.URL.RawQuery
	}

	var reqBodyBytes []byte
	if req.Body != nil {
		reqBodyBytes, _ = io.ReadAll(req.Body)
		req.Body = io.NopCloser(bytes.NewReader(reqBodyBytes))
	}
	if len(reqBodyBytes) == 0 && (req.Method == "POST" || req.Method == "PUT" || req.Method == "PATCH") {
		if req.PostForm != nil && len(req.PostForm) > 0 {
			reqBodyBytes = []byte(req.PostForm.Encode())
		} else if req.Form != nil && len(req.Form) > 0 {
			queryKeys := req.URL.Query()
			postValues := url.Values{}
			for k, vs := range req.Form {
				if _, inQuery := queryKeys[k]; !inQuery {
					for _, v := range vs {
						postValues.Add(k, v)
					}
				}
			}
			if len(postValues) > 0 {
				reqBodyBytes = []byte(postValues.Encode())
			}
		}
	}

	var proxyReq *http.Request
	var err error
	if len(reqBodyBytes) > 0 {
		proxyReq, err = http.NewRequest(req.Method, targetURL, bytes.NewReader(reqBodyBytes))
		if err != nil {
			return ctx.Response().Status(500).String(err.Error())
		}
		proxyReq.ContentLength = int64(len(reqBodyBytes))
	} else {
		proxyReq, err = http.NewRequest(req.Method, targetURL, nil)
		if err != nil {
			return ctx.Response().Status(500).String(err.Error())
		}
	}

	// 1. Copy incoming request headers (filtering out hop-by-hop headers)
	for key, values := range req.Header {
		if strings.EqualFold(key, "Host") || hopByHopHeaders[key] || strings.EqualFold(key, "Content-Length") {
			continue
		}
		for _, value := range values {
			proxyReq.Header.Add(key, value)
		}
	}
	proxyReq.Host = "127.0.0.1:8085"
	fwdProto := requestForwardedProto(req)
	proxyReq.Header.Set("X-Forwarded-Host", req.Host)
	proxyReq.Header.Set("X-Forwarded-Proto", fwdProto)
	proxyReq.Header.Set("X-Forwarded-Prefix", "/phpmyadmin")
	proxyReq.Header.Set("X-Forwarded-For", req.RemoteAddr)
	if fwdProto == "https" {
		proxyReq.Header.Set("HTTPS", "on")
	}

	// 2. Execute request to backend phpMyAdmin
	resp, err := r.client.Do(proxyReq)
	if err != nil {
		// If AJAX request, return json error instead of plain text 502
		if req.Header.Get("X-Requested-With") == "XMLHttpRequest" || strings.Contains(req.Header.Get("Accept"), "application/json") {
			return ctx.Response().Status(200).Json(goravelhttp.Json{
				"status":  true,
				"message": "Service warming up",
			})
		}
		return ctx.Response().Status(502).String("phpMyAdmin daemon initializing: " + err.Error())
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return ctx.Response().Status(502).String("phpMyAdmin proxy read failed: " + err.Error())
	}

	response := ctx.Response()
	for _, cookie := range resp.Cookies() {
		response.Cookie(goravelhttp.Cookie{
			Name:     cookie.Name,
			Value:    cookie.Value,
			Path:     "/phpmyadmin/",
			Domain:   "",
			Expires:  cookie.Expires,
			MaxAge:   cookie.MaxAge,
			Secure:   requestForwardedProto(req) == "https",
			HttpOnly: cookie.HttpOnly,
			SameSite: "lax",
		})
	}

	for key, values := range resp.Header {
		if strings.EqualFold(key, "Set-Cookie") || hopByHopHeaders[key] {
			continue
		}
		for _, value := range values {
			if strings.EqualFold(key, "Location") {
				if strings.Contains(value, "127.0.0.1:8085") {
					value = strings.Replace(value, "http://127.0.0.1:8085", "/phpmyadmin", 1)
				} else if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
					// External full URL, leave as is
				} else if strings.HasPrefix(value, "/phpmyadmin") {
					// Already has /phpmyadmin prefix
				} else if strings.HasPrefix(value, "/login") || strings.HasPrefix(value, "/dashboard") || strings.HasPrefix(value, "/databases") || strings.HasPrefix(value, "/websites") {
					// Panel root routes, leave as is
				} else if strings.HasPrefix(value, "/") {
					value = "/phpmyadmin" + value
				} else {
					value = "/phpmyadmin/" + value
				}
			}
			response.Header(key, value)
		}
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "text/html; charset=utf-8"
	}

	return response.Status(resp.StatusCode).Data(contentType, bodyBytes)
}
