package middleware

import (
	"net/url"
	"strings"

	goravelhttp "github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type AuthMiddleware struct {
	authService *services.AuthService
}

func NewAuthMiddleware() *AuthMiddleware {
	return &AuthMiddleware{
		authService: services.NewAuthService(),
	}
}

func (m *AuthMiddleware) Signature() string {
	return "auth_root"
}

// sameOriginOK rejects cookie-authenticated state-changing requests coming from another origin (CSRF).
// Requests carrying an Authorization header cannot be forged cross-site, so they are always fine.
func sameOriginOK(ctx goravelhttp.Context, usedCookie bool) bool {
	if !usedCookie {
		return true
	}
	switch ctx.Request().Method() {
	case "GET", "HEAD", "OPTIONS":
		return true
	}
	origin := ctx.Request().Header("Origin", "")
	if origin == "" {
		origin = ctx.Request().Header("Referer", "")
	}
	if origin == "" {
		return false
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return strings.EqualFold(u.Host, ctx.Request().Host())
}

// bearerOrCookie extracts the session token. Tokens are never accepted from the query string,
// since URLs leak into logs, history and Referer headers.
func bearerOrCookie(ctx goravelhttp.Context, cookieName string) (token string, usedCookie bool) {
	if h := ctx.Request().Header("Authorization", ""); strings.HasPrefix(h, "Bearer ") {
		return strings.TrimPrefix(h, "Bearer "), false
	}
	if c := ctx.Request().Cookie(cookieName); c != "" {
		return c, true
	}
	return "", false
}

func (m *AuthMiddleware) Handle(ctx goravelhttp.Context) {
	rawPath := ctx.Request().Path()
	path := "/" + strings.TrimPrefix(rawPath, "/")

	// 1. Whitelist public auth endpoints, client APIs (handled by ClientAuthMiddleware), phpMyAdmin & its assets, and static build files
	if strings.HasPrefix(path, "/phpmyadmin") || path == "/index.php" || path == "/url.php" || strings.HasPrefix(path, "/themes/") || strings.HasPrefix(path, "/js/") || strings.HasPrefix(path, "/api/client/") || path == "/api/auth/login" || path == "/login" || strings.HasPrefix(path, "/public/") || strings.HasPrefix(path, "/build/") || strings.HasPrefix(path, "/assets/") || strings.HasPrefix(path, "/webmail") || strings.HasPrefix(path, "/roundcube") {
		ctx.Request().Next()
		return
	}

	// The client portal (port 2083) never serves root APIs.
	if strings.HasPrefix(path, "/api/") && strings.EqualFold(ctx.Request().Header("X-Panel-Scope", ""), "client") {
		ctx.Request().AbortWithStatusJson(403, goravelhttp.Json{
			"status":  false,
			"message": "Forbidden: root APIs are only available on the admin port.",
		})
		return
	}

	token, usedCookie := bearerOrCookie(ctx, "ak_session")
	claims, valid := m.authService.ValidateToken(token)
	if !valid {
		// If it is an API request, strictly enforce 401 Unauthorized
		if strings.HasPrefix(path, "/api/") {
			ctx.Request().AbortWithStatusJson(401, goravelhttp.Json{
				"status":  false,
				"message": "Unauthorized: Root authentication required.",
			})
			return
		}
		// For browser SPA pages, allow SPA HTML to load so React renders <LoginView />
		ctx.Request().Next()
		return
	}

	if strings.HasPrefix(path, "/api/") && !sameOriginOK(ctx, usedCookie) {
		ctx.Request().AbortWithStatusJson(403, goravelhttp.Json{
			"status":  false,
			"message": "Forbidden: cross-origin request rejected.",
		})
		return
	}

	// Attach authenticated user claims to context
	ctx.WithValue("user", claims)
	ctx.Request().Next()
}
