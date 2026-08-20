package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerWebServersRoutes(webServersController *controllers.WebServersController) {
	// WebServer Profiles & Services Management API
	facades.Route().Get("/api/webservers/profiles", webServersController.Profiles)
	facades.Route().Post("/api/webservers/profile", webServersController.SwitchProfile)
	facades.Route().Get("/api/webservers/services", webServersController.Services)
	facades.Route().Post("/api/webservers/service/action", webServersController.ControlService)
	facades.Route().Get("/api/webservers/templates", webServersController.TemplateFiles)
	facades.Route().Get("/api/webservers/template", webServersController.GetTemplate)
	facades.Route().Post("/api/webservers/template", webServersController.SaveTemplate)
	facades.Route().Get("/api/webservers/main-configs", webServersController.MainConfigs)
	facades.Route().Post("/api/webservers/main-configs", webServersController.SaveMainConfig)
	facades.Route().Get("/api/webservers/domain-vhost", webServersController.DomainVhost)
	facades.Route().Post("/api/webservers/domain-vhost", webServersController.SaveDomainVhost)
	facades.Route().Post("/api/webservers/rebuild", webServersController.RebuildAll)
	facades.Route().Get("/api/webservers/apache-status", webServersController.ApacheStatus)
}
