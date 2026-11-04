package controllers

import (
	"strings"

	goravelhttp "github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type AuthController struct {
	authService *services.AuthService
}

func NewAuthController() *AuthController {
	return &AuthController{
		authService: services.NewAuthService(),
	}
}

type LoginRequest struct {
	Username string `json:"username" form:"username"`
	Password string `json:"password" form:"password"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" form:"old_password"`
	NewPassword string `json:"new_password" form:"new_password"`
}

// Login handles root authentication
func (c *AuthController) Login(ctx goravelhttp.Context) goravelhttp.Response {
	var req LoginRequest
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  false,
			"message": "Invalid request payload",
		})
	}

	limiter := services.GetLoginLimiter()
	ip := requestIP(ctx)
	if ok, wait := limiter.Allowed("admin", ip, req.Username); !ok {
		return tooManyAttempts(ctx, wait)
	}

	token, err := c.authService.Authenticate(req.Username, req.Password)
	if err != nil {
		limiter.Fail("admin", ip, req.Username)
		return ctx.Response().Status(401).Json(goravelhttp.Json{
			"status":  false,
			"message": "Invalid root credentials",
		})
	}
	limiter.Success("admin", ip, req.Username)

	setSessionCookie(ctx, "ak_session", token, services.AdminTokenTTL)

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": true,
		"token":  token,
		"user": map[string]any{
			"username": "root",
			"role":     "root_admin",
		},
		"message": "Root login successful",
	})
}

// Logout revokes the current token and clears the session cookie
func (c *AuthController) Logout(ctx goravelhttp.Context) goravelhttp.Response {
	if token := c.extractToken(ctx); token != "" {
		c.authService.Revoke(token)
	}
	setSessionCookie(ctx, "ak_session", "", 0)

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  true,
		"message": "Logged out successfully",
	})
}

// Me returns current authenticated root details
func (c *AuthController) Me(ctx goravelhttp.Context) goravelhttp.Response {
	token := c.extractToken(ctx)
	claims, valid := c.authService.ValidateToken(token)
	if !valid {
		return ctx.Response().Status(401).Json(goravelhttp.Json{
			"status":  false,
			"message": "Unauthorized. Invalid or expired token.",
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": true,
		"user": map[string]any{
			"username": claims["username"],
			"role":     claims["role"],
		},
	})
}

// ChangePassword allows updating root password
func (c *AuthController) ChangePassword(ctx goravelhttp.Context) goravelhttp.Response {
	token := c.extractToken(ctx)
	if _, valid := c.authService.ValidateToken(token); !valid {
		return ctx.Response().Status(401).Json(goravelhttp.Json{
			"status":  false,
			"message": "Unauthorized",
		})
	}

	var req ChangePasswordRequest
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  false,
			"message": "Invalid request payload",
		})
	}

	if err := c.authService.ChangePassword(req.OldPassword, req.NewPassword); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  false,
			"message": err.Error(),
		})
	}

	// All existing sessions were invalidated; hand this browser a fresh one.
	if token, err := c.authService.IssueToken("root", "root_admin", services.TokenScopeAdmin, services.AdminTokenTTL); err == nil {
		setSessionCookie(ctx, "ak_session", token, services.AdminTokenTTL)
		return ctx.Response().Status(200).Json(goravelhttp.Json{
			"status":  true,
			"token":   token,
			"message": "Root password changed successfully",
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  true,
		"message": "Root password changed successfully",
	})
}

func (c *AuthController) extractToken(ctx goravelhttp.Context) string {
	authHeader := ctx.Request().Header("Authorization", "")
	if strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}
	return ctx.Request().Cookie("ak_session")
}
