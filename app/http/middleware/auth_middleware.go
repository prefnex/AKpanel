package middleware

import (
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

func (m *AuthMiddleware) Handle(ctx goravelhttp.Context) {
	rawPath := ctx.Request().Path()
	path := "/" + strings.TrimPrefix(rawPath, "/")

	// 1. Whitelist public auth endpoints, client APIs (handled by ClientAuthMiddleware), phpMyAdmin & its assets, and static build files
	if strings.HasPrefix(path, "/phpmyadmin") || path == "/index.php" || path == "/url.php" || strings.HasPrefix(path, "/themes/") || strings.HasPrefix(path, "/js/") || strings.HasPrefix(path, "/api/client/") || path == "/api/auth/login" || path == "/login" || strings.HasPrefix(path, "/public/") || strings.HasPrefix(path, "/build/") || strings.HasPrefix(path, "/assets/") {
		ctx.Request().Next()
		return
	}

	// 2. Extract token from Header, Cookie, or Query
	var token string
	authHeader := ctx.Request().Header("Authorization", "")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token = strings.TrimPrefix(authHeader, "Bearer ")
	}
	if token == "" {
		token = ctx.Request().Cookie("ak_session")
	}
	if token == "" {
		token = ctx.Request().Query("token", "")
	}

	// 3. Validate Token
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

	// Attach authenticated user claims to context
	ctx.WithValue("user", claims)
	ctx.Request().Next()
}
