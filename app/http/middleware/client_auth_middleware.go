package middleware

import (
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/services"
)

type ClientAuthMiddleware struct {
	userService *services.UserAccountService
}

func NewClientAuthMiddleware() *ClientAuthMiddleware {
	return &ClientAuthMiddleware{
		userService: services.NewUserAccountService(),
	}
}

func (m *ClientAuthMiddleware) Signature() string {
	return "auth_client"
}

func (m *ClientAuthMiddleware) Handle(ctx http.Context) {
	path := ctx.Request().Path()

	// Public auth endpoints & assets
	if strings.HasPrefix(path, "/api/client/auth/login") ||
		strings.HasPrefix(path, "/api/client/auth/reset-password") ||
		strings.HasPrefix(path, "/public/") ||
		strings.HasPrefix(path, "/build/") ||
		path == "/favicon.ico" || path == "/robots.txt" {
		ctx.Request().Next()
		return
	}

	// Only apply strictly to /api/client/ routes
	if !strings.HasPrefix(path, "/api/client/") {
		ctx.Request().Next()
		return
	}

	authHeader := ctx.Request().Header("Authorization")
	var tokenString string

	if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
		tokenString = strings.TrimPrefix(authHeader, "Bearer ")
	} else {
		tokenString = ctx.Request().Query("token", "")
		if tokenString == "" {
			tokenString = ctx.Request().Cookie("ak_client_token", "")
		}
	}

	if tokenString == "" {
		ctx.Response().Status(401).Json(http.Json{
			"status":  false,
			"message": "Unauthorized: Client authentication token required.",
		})
		ctx.Request().Abort()
		return
	}

	secret := facades.Config().GetString("app.key", "AKpanel-SuperSecretKey-2026-ChangeInProduction!")
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		ctx.Response().Status(401).Json(http.Json{
			"status":  false,
			"message": "Unauthorized: Invalid or expired client session.",
		})
		ctx.Request().Abort()
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		ctx.Response().Status(401).Json(http.Json{
			"status":  false,
			"message": "Unauthorized: Malformed client token claims.",
		})
		ctx.Request().Abort()
		return
	}

	username, _ := claims["username"].(string)
	role, _ := claims["role"].(string)

	if username == "" {
		ctx.Response().Status(401).Json(http.Json{
			"status":  false,
			"message": "Unauthorized: User context not found in token.",
		})
		ctx.Request().Abort()
		return
	}

	// If root_admin or admin is impersonating or logging in as client, allow
	if role != "root_admin" && role != "client_user" && role != "client" && role != "admin" {
		ctx.Response().Status(403).Json(http.Json{
			"status":  false,
			"message": "Forbidden: Client account privileges required.",
		})
		ctx.Request().Abort()
		return
	}

	// Check if client account is active (not suspended) — fast JSON lookup only.
	if username != "root" && username != "admin" {
		foundUser, _ := m.userService.GetUser(username)
		if foundUser != nil && foundUser.Status == "suspended" {
			ctx.Response().Status(403).Json(http.Json{
				"status":  false,
				"message": "Account Suspended: " + foundUser.SuspendedReason,
			})
			ctx.Request().Abort()
			return
		}
	}

	// Inject tenant user to context
	ctx.WithValue("client_username", username)
	ctx.WithValue("client_role", role)

	ctx.Request().Next()
}
