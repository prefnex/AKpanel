package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerWebsitesRoutes(websitesController *controllers.WebsitesController) {
	// Templates API (The 10 pre-configured templates)
	facades.Route().Get("/api/templates", websitesController.Templates)

	// Websites Management API
	facades.Route().Get("/api/websites", websitesController.Index)
	facades.Route().Post("/api/websites", websitesController.Store)
	facades.Route().Post("/api/websites/switch-engine", websitesController.SwitchEngine)
	facades.Route().Post("/api/websites/delete", websitesController.Destroy)
	facades.Route().Delete("/api/websites", websitesController.Destroy)
}
