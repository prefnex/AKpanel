package main

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net"
	nethttp "net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"sync"
	"strings"
	"time"

	"goravel/app/facades"
	"goravel/app/services"
	"goravel/bootstrap"
)

var (
	tlsCertCacheMu sync.RWMutex
	tlsCertCache   *tls.Certificate
	tlsCertKey     string
	tlsCertMod     time.Time
)

func resolveCertPaths() (certPath, keyPath string) {
	certPath = "/etc/akpanel/ssl/server/fullchain.pem"
	keyPath = "/etc/akpanel/ssl/server/privkey.pem"
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		certPath = "/etc/ssl/certs/akpanel-selfsigned.crt"
		keyPath = "/etc/ssl/private/akpanel-selfsigned.key"
	}
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		acme := services.NewACMEService()
		c, k, _ := acme.GenerateSelfSigned("localhost")
		certPath = c
		keyPath = k
	}
	return certPath, keyPath
}

// getHostCertificate loads the active panel TLS certificate (cached until file mtime changes).
func getHostCertificate(info *tls.ClientHelloInfo) (*tls.Certificate, error) {
	certPath, keyPath := resolveCertPaths()
	cacheKey := certPath + "|" + keyPath

	certInfo, err := os.Stat(certPath)
	if err != nil {
		return nil, err
	}
	keyInfo, err := os.Stat(keyPath)
	if err != nil {
		return nil, err
	}
	modTime := certInfo.ModTime()
	if keyInfo.ModTime().After(modTime) {
		modTime = keyInfo.ModTime()
	}

	tlsCertCacheMu.RLock()
	if tlsCertCache != nil && tlsCertKey == cacheKey && !modTime.After(tlsCertMod) {
		cached := tlsCertCache
		tlsCertCacheMu.RUnlock()
		return cached, nil
	}
	tlsCertCacheMu.RUnlock()

	cert, err := tls.LoadX509KeyPair(certPath, keyPath)
	if err != nil {
		return nil, err
	}

	tlsCertCacheMu.Lock()
	tlsCertCache = &cert
	tlsCertKey = cacheKey
	tlsCertMod = modTime
	tlsCertCacheMu.Unlock()
	return &cert, nil
}

// cmuxListener inspects the first byte of incoming TCP connection to transparently handle both TLS (HTTPS) and plain HTTP on the same port
type cmuxListener struct {
	net.Listener
	tlsConfig *tls.Config
}

type bufferedConn struct {
	net.Conn
	r io.Reader
}

func (b *bufferedConn) Read(p []byte) (int, error) {
	return b.r.Read(p)
}

func (l *cmuxListener) Accept() (net.Conn, error) {
	for {
		conn, err := l.Listener.Accept()
		if err != nil {
			return nil, err
		}

		_ = conn.SetReadDeadline(time.Now().Add(5 * time.Second))
		buf := make([]byte, 1)
		n, err := conn.Read(buf)
		_ = conn.SetReadDeadline(time.Time{})

		if err != nil {
			// Client disconnected before sending bytes (e.g. port scan, TCP probe, aborted conn).
			// Safely close this single connection and loop to accept the next one without killing the listener.
			conn.Close()
			continue
		}

		combinedReader := io.MultiReader(bytes.NewReader(buf[:n]), conn)
		bConn := &bufferedConn{
			Conn: conn,
			r:    combinedReader,
		}

		// 0x16 is the first byte of a TLS Handshake (Record Type: Handshake)
		if buf[0] == 0x16 && l.tlsConfig != nil {
			tlsConn := tls.Server(bConn, l.tlsConfig)
			return tlsConn, nil
		}

		// Plain HTTP connection
		return bConn, nil
	}
}

// createPanelHandler creates an HTTP/HTTPS handler with reverse proxy to internal Goravel backend and automatic HTTP->HTTPS redirect
func createPanelHandler(targetURL string, port string, scope string) nethttp.Handler {
	target, _ := url.Parse(targetURL)
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.Transport = &nethttp.Transport{
		Proxy:                 nethttp.ProxyFromEnvironment,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   32,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
	originalDirector := proxy.Director

	proxy.Director = func(req *nethttp.Request) {
		originalDirector(req)
		req.Header.Set("X-Forwarded-Port", port)
		req.Header.Set("X-Panel-Scope", scope)
		if req.TLS != nil {
			req.Header.Set("X-Forwarded-Proto", "https")
		} else {
			req.Header.Set("X-Forwarded-Proto", "http")
		}
	}

	return nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		if r.TLS == nil {
			host := r.Host
			if strings.Contains(host, ":") {
				host = strings.Split(host, ":")[0]
			}
			// IP literals: serve plain HTTP (no cert for IP; avoids broken redirect loops).
			if net.ParseIP(host) != nil {
				proxy.ServeHTTP(w, r)
				return
			}
			targetHTTPS := fmt.Sprintf("https://%s:%s%s", host, port, r.URL.RequestURI())
			nethttp.Redirect(w, r, targetHTTPS, nethttp.StatusMovedPermanently)
			return
		}

		proxy.ServeHTTP(w, r)
	})
}

func startPanelListener(addr string, port string, scope string, targetURL string, tlsConfig *tls.Config) {
	for {
		ln, err := net.Listen("tcp", addr)
		if err != nil {
			log.Printf("❌ Failed to bind %s on %s: %v", scope, addr, err)
			time.Sleep(2 * time.Second)
			continue
		}

		muxLn := &cmuxListener{
			Listener:  ln,
			tlsConfig: tlsConfig,
		}

		handler := createPanelHandler(targetURL, port, scope)
		server := &nethttp.Server{
			Handler:      handler,
			ReadTimeout:  120 * time.Second,
			WriteTimeout: 120 * time.Second,
			IdleTimeout:  120 * time.Second,
			TLSConfig:    tlsConfig,
		}

		log.Printf("🌟 [AKpanel] %s Panel listening on https://%s (HTTP auto-redirect enabled)", strings.Title(scope), addr)
		if err := server.Serve(muxLn); err != nil && err != nethttp.ErrServerClosed {
			log.Printf("⚠️ [AKpanel] %s server restarted after error: %v", scope, err)
			time.Sleep(1 * time.Second)
		} else {
			break
		}
	}
}

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--bootstrap-services" {
		if err := services.BootstrapPanelServices(); err != nil {
			log.Printf("⚠️ [AKpanel] bootstrap finished with errors: %v", err)
			os.Exit(1)
		}
		log.Println("✅ [AKpanel] service bootstrap complete")
		return
	}

	services.EnsurePanelMariaDB()
	app := bootstrap.Boot()

	tlsConfig := &tls.Config{
		GetCertificate: getHostCertificate,
		MinVersion:     tls.VersionTLS12,
	}

	// 1. Start concurrent Admin Panel listener on Port 2087 (HTTPS/HTTP)
	go func() {
		// Wait for internal Goravel backend on 2088
		for i := 0; i < 30; i++ {
			time.Sleep(300 * time.Millisecond)
			resp, err := nethttp.Get("http://127.0.0.1:2088/api/auth/me")
			if err == nil {
				resp.Body.Close()
				break
			}
		}

		go startPanelListener("0.0.0.0:2087", "2087", "admin", "http://127.0.0.1:2088", tlsConfig)
		go startPanelListener("0.0.0.0:2083", "2083", "client", "http://127.0.0.1:2088", tlsConfig)
	}()

	_ = facades.Artisan().Call("migrate")
	go services.StartPanelDBReplica()

	log.Println("👑 [AKpanel] Starting Goravel Core Backend Engine on 127.0.0.1:2088...")
	app.Start()
}
