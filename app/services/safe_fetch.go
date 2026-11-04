package services

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
	"time"
)

const maxRemoteDownloadBytes = 2 << 30 // 2 GiB

// ValidateRemoteURL accepts only absolute http(s) URLs (no file://, gopher://, dict://, ...).
func ValidateRemoteURL(raw string) (*url.URL, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" {
		return nil, fmt.Errorf("invalid URL")
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, fmt.Errorf("only http and https URLs are allowed")
	}
	if u.User != nil {
		return nil, fmt.Errorf("credentials in URLs are not allowed")
	}
	return u, nil
}

// isPublicIP rejects loopback, private, link-local (cloud metadata), CGNAT, multicast and unspecified ranges.
func isPublicIP(ip net.IP) bool {
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsMulticast() || ip.IsUnspecified() || ip.IsInterfaceLocalMulticast() {
		return false
	}
	if v4 := ip.To4(); v4 != nil {
		if v4[0] == 0 || (v4[0] == 100 && v4[1]&0xc0 == 64) || (v4[0] == 192 && v4[1] == 0 && v4[2] == 0) || v4[0] >= 240 {
			return false
		}
	}
	return true
}

// newPublicOnlyClient returns an HTTP client that refuses to connect to non-public addresses.
// The check runs on the resolved address at connect time, so DNS rebinding and redirects to
// internal hosts are blocked as well.
func newPublicOnlyClient(timeout time.Duration) *http.Client {
	dialer := &net.Dialer{
		Timeout: 15 * time.Second,
		Control: func(network, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return err
			}
			ip := net.ParseIP(host)
			if ip == nil || !isPublicIP(ip) {
				return fmt.Errorf("connections to internal address %s are not allowed", host)
			}
			return nil
		},
	}
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           dialer.DialContext,
		TLSHandshakeTimeout:   15 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
	}
	return &http.Client{
		Timeout:   timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects")
			}
			if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
				return fmt.Errorf("redirect to unsupported scheme")
			}
			return nil
		},
	}
}

// FetchRemote streams a remote http(s) resource into w, capped at maxRemoteDownloadBytes.
func FetchRemote(rawURL string, w io.Writer) error {
	u, err := ValidateRemoteURL(rawURL)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "AKpanel-FileManager/1.0")
	resp, err := newPublicOnlyClient(30 * time.Minute).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("remote server returned %s", resp.Status)
	}
	n, err := io.Copy(w, io.LimitReader(resp.Body, maxRemoteDownloadBytes+1))
	if err != nil {
		return err
	}
	if n > maxRemoteDownloadBytes {
		return fmt.Errorf("remote file exceeds the 2 GiB limit")
	}
	return nil
}
