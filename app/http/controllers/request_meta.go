package controllers

import (
	"net"
	"strconv"
	"strings"
	"time"

	"github.com/goravel/framework/contracts/http"
)

// requestIP returns the real client address. The panel listeners on 2087/2083 proxy to the
// loopback backend and overwrite X-Real-IP, so the header is trusted only from loopback.
func requestIP(ctx http.Context) string {
	ip := ctx.Request().Ip()
	if parsed := net.ParseIP(ip); parsed != nil && parsed.IsLoopback() {
		if real := strings.TrimSpace(ctx.Request().Header("X-Real-IP", "")); real != "" {
			return real
		}
	}
	return ip
}

func requestIsHTTPS(ctx http.Context) bool {
	return strings.EqualFold(ctx.Request().Header("X-Forwarded-Proto", ""), "https")
}

// setSessionCookie writes an HttpOnly, SameSite=Strict session cookie (Secure over HTTPS).
func setSessionCookie(ctx http.Context, name, value string, ttl time.Duration) {
	maxAge := int(ttl.Seconds())
	expires := time.Now().Add(ttl)
	if value == "" {
		maxAge = -1
		expires = time.Now().Add(-time.Hour)
	}
	ctx.Response().Cookie(http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		Expires:  expires,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   requestIsHTTPS(ctx),
		SameSite: "strict",
	})
}

func tooManyAttempts(ctx http.Context, wait time.Duration) http.Response {
	ctx.Response().Header("Retry-After", strconv.Itoa(int(wait.Seconds())+1))
	return ctx.Response().Status(429).Json(http.Json{
		"status":  false,
		"message": "Too many failed login attempts. Try again in " + wait.Round(time.Minute).String() + ".",
	})
}
