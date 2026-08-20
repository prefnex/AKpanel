package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerAuthRoutes(authController *controllers.AuthController) {
	// Auth APIs
	facades.Route().Post("/api/auth/login", authController.Login)
	facades.Route().Post("/api/auth/logout", authController.Logout)
	facades.Route().Get("/api/auth/me", authController.Me)
	facades.Route().Post("/api/auth/change-password", authController.ChangePassword)
	// Kept as a compatibility alias for the existing dashboard header.
	facades.Route().Post("/api/auth/password", authController.ChangePassword)
}
