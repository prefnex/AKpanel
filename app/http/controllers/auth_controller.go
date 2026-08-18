package controllers

import (
	"strings"
	"time"

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

	token, err := c.authService.Authenticate(req.Username, req.Password)
	if err != nil {
		return ctx.Response().Status(401).Json(goravelhttp.Json{
			"status":  false,
			"message": "Invalid root credentials: " + err.Error(),
		})
	}

	// Set secure HTTP-only session cookie
	ctx.Response().Cookie(goravelhttp.Cookie{
		Name:     "ak_session",
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(24 * time.Hour),
		MaxAge:   86400,
		HttpOnly: true,
		Secure:   false,
		SameSite: "lax",
	})

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

// Logout clears the session cookie
func (c *AuthController) Logout(ctx goravelhttp.Context) goravelhttp.Response {
	ctx.Response().Cookie(goravelhttp.Cookie{
		Name:     "ak_session",
		Value:    "",
		Path:     "/",
		Expires:  time.Now().Add(-1 * time.Hour),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   false,
		SameSite: "lax",
	})

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
	cookieToken := ctx.Request().Cookie("ak_session")
	if cookieToken != "" {
		return cookieToken
	}
	return ctx.Request().Query("token", "")
}
