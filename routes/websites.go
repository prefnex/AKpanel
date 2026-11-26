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
	facades.Route().Post("/api/websites/stack", websitesController.UpdateStack)
	facades.Route().Get("/api/websites/services", websitesController.Services)
	facades.Route().Post("/api/websites/services", websitesController.UpdateServices)
	facades.Route().Get("/api/websites/vhost-templates", websitesController.VhostTemplates)
	facades.Route().Post("/api/websites/vhost-templates", websitesController.UpdateVhostTemplates)
	facades.Route().Post("/api/websites/vhost-preview", websitesController.PreviewVhost)

	// Subdomains (sites under another site, same owner and stack)
	subdomains := controllers.NewSubdomainsController()
	facades.Route().Get("/api/subdomains", subdomains.Index)
	facades.Route().Post("/api/subdomains", subdomains.Store)
	facades.Route().Post("/api/subdomains/delete", subdomains.Destroy)
	facades.Route().Post("/api/websites/switch-engine", websitesController.SwitchEngine)
	facades.Route().Post("/api/websites/delete", websitesController.Destroy)
	facades.Route().Delete("/api/websites", websitesController.Destroy)
}
