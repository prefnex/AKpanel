package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerServerSettingsRoutes(serverSettingsController *controllers.ServerSettingsController) {
	// Server & CWP Settings API (Hostname & Hostname SSL)
	facades.Route().Get("/api/settings/server", serverSettingsController.GetSettings)
	facades.Route().Post("/api/settings/server", serverSettingsController.SaveSettings)
	facades.Route().Post("/api/settings/hostname-ssl", serverSettingsController.IssueHostnameSSL)
	facades.Route().Post("/api/settings/hostname-ssl/issue", serverSettingsController.IssueHostnameSSL)
	facades.Route().Post("/api/settings/hostname-ssl/custom", serverSettingsController.SaveCustomHostnameSSL)
}
