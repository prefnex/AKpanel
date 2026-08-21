package controllers

import (
	"net/http"
	"strings"
)

func requestForwardedProto(req *http.Request) string {
	if req == nil {
		return "http"
	}
	if proto := strings.TrimSpace(req.Header.Get("X-Forwarded-Proto")); proto != "" {
		if i := strings.IndexByte(proto, ','); i >= 0 {
			proto = proto[:i]
		}
		proto = strings.ToLower(strings.TrimSpace(proto))
		if proto == "https" || proto == "http" {
			return proto
		}
	}
	if req.TLS != nil {
		return "https"
	}
	return "http"
}
