package middleware

import (
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type ClientAuthMiddleware struct {
	userService *services.UserAccountService
	authService *services.AuthService
}

func NewClientAuthMiddleware() *ClientAuthMiddleware {
	return &ClientAuthMiddleware{
		userService: services.NewUserAccountService(),
		authService: services.NewAuthService(),
	}
}

func (m *ClientAuthMiddleware) Signature() string {
	return "auth_client"
}

func clientDeny(ctx http.Context, status int, msg string) {
	ctx.Request().AbortWithStatusJson(status, http.Json{"status": false, "message": msg})
}

func (m *ClientAuthMiddleware) Handle(ctx http.Context) {
	path := ctx.Request().Path()

	// Public auth endpoints & assets
	if path == "/api/client/auth/login" ||
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

	tokenString, usedCookie := bearerOrCookie(ctx, "ak_client_token")
	if tokenString == "" {
		clientDeny(ctx, 401, "Unauthorized: Client authentication token required.")
		return
	}

	// Client tokens are signed with the per-server secret and must carry the client scope,
	// so neither a root token nor a forged token is accepted here.
	claims, ok := m.authService.ValidateScoped(tokenString, services.TokenScopeClient)
	if !ok {
		clientDeny(ctx, 401, "Unauthorized: Invalid or expired client session.")
		return
	}
	if !sameOriginOK(ctx, usedCookie) {
		clientDeny(ctx, 403, "Forbidden: cross-origin request rejected.")
		return
	}

	username, _ := claims["username"].(string)
	if username == "" || !services.IsValidAccountUsername(username) {
		clientDeny(ctx, 401, "Unauthorized: User context not found in token.")
		return
	}

	// The account must still exist and be active.
	foundUser, err := m.userService.GetUser(username)
	if err != nil || foundUser == nil {
		clientDeny(ctx, 401, "Unauthorized: Hosting account no longer exists.")
		return
	}
	if foundUser.Status == "suspended" {
		clientDeny(ctx, 403, "Account Suspended: "+foundUser.SuspendedReason)
		return
	}

	ctx.WithValue("client_username", foundUser.Username)
	ctx.WithValue("client_role", "client")
	ctx.Request().Next()
}
