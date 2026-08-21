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
	"goravel/app/services"
)

type WebmailController struct {
	targetBase string
	client     *http.Client
}

func NewWebmailController() *WebmailController {
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

	return &WebmailController{
		targetBase: "http://127.0.0.1:8086",
		client: &http.Client{
			Transport: transport,
			Timeout:   120 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

// Proxy handles transparent reverse proxying to Roundcube on port 8086 with full session persistence & AJAX stability
func (r *WebmailController) Proxy(ctx goravelhttp.Context) goravelhttp.Response {
	req := ctx.Request().Origin()

	path := req.URL.Path
	// Gin cannot register /webmail/sso and /webmail/*path together; handle SSO here.
	if path == "/webmail/sso" {
		return r.SSO(ctx)
	}
	if path == "/webmail" || path == "/roundcube" {
		targetRedirect := "/roundcube/"
		if req.URL.RawQuery != "" {
			targetRedirect += "?" + req.URL.RawQuery
		}
		return ctx.Response().Redirect(301, targetRedirect)
	}

	if strings.HasPrefix(path, "/webmail/") {
		path = strings.TrimPrefix(path, "/webmail")
	} else if strings.HasPrefix(path, "/roundcube/") {
		path = strings.TrimPrefix(path, "/roundcube")
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

	for key, values := range req.Header {
		if strings.EqualFold(key, "Host") || hopByHopHeaders[key] || strings.EqualFold(key, "Content-Length") {
			continue
		}
		for _, value := range values {
			proxyReq.Header.Add(key, value)
		}
	}
	proxyReq.Host = "127.0.0.1:8086"
	proxyReq.Header.Set("X-Forwarded-Host", req.Host)
	fwdProto := requestForwardedProto(req)
	proxyReq.Header.Set("X-Forwarded-Proto", fwdProto)
	proxyReq.Header.Set("X-Forwarded-Prefix", "/roundcube")
	proxyReq.Header.Set("X-Forwarded-For", req.RemoteAddr)

	resp, err := r.client.Do(proxyReq)
	if err != nil {
		_ = services.NewNginxService().EnsureRoundcubeListener()
		resp, err = r.client.Do(proxyReq)
	}
	if err != nil {
		if req.Header.Get("X-Requested-With") == "XMLHttpRequest" || strings.Contains(req.Header.Get("Accept"), "application/json") {
			return ctx.Response().Status(200).Json(goravelhttp.Json{
				"status":  true,
				"message": "Roundcube webmail warming up",
			})
		}
		return ctx.Response().Status(502).String("Roundcube webmail daemon initializing: " + err.Error())
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	response := ctx.Response()
	for _, cookie := range resp.Cookies() {
		response.Cookie(goravelhttp.Cookie{
			Name:     cookie.Name,
			Value:    cookie.Value,
			Path:     "/",
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
				if strings.Contains(value, "127.0.0.1:8086") {
					value = strings.Replace(value, "http://127.0.0.1:8086", "/roundcube", 1)
				} else if strings.HasPrefix(value, "http://") || strings.HasPrefix(value, "https://") {
					// full url
				} else if strings.HasPrefix(value, "/roundcube") || strings.HasPrefix(value, "/webmail") {
					// already prefixed
				} else if strings.HasPrefix(value, "/") {
					value = "/roundcube" + value
				} else {
					value = "/roundcube/" + value
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

// SSO renders an auto-submit Roundcube login using the Dovecot master user.
func (r *WebmailController) SSO(ctx goravelhttp.Context) goravelhttp.Response {
	token := ctx.Request().Query("token", "")
	if !services.PeekWebmailSSOToken(token) {
		return ctx.Response().Status(400).String("Webmail login link expired. Open webmail again from the panel.")
	}
	return ctx.Response().Redirect(302, "/roundcube/?_task=login&sso="+url.QueryEscape(token))
}
