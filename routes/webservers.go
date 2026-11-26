package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerWebServersRoutes(webServersController *controllers.WebServersController) {
	// WebServer Profiles & Services Management API
	facades.Route().Get("/api/webservers/modes", webServersController.Modes)
	facades.Route().Get("/api/webservers/library", webServersController.VhostLibrary)
	facades.Route().Get("/api/webservers/status-info", webServersController.StatusInfo)
	facades.Route().Get("/api/webservers/redirects", webServersController.SystemRedirects)
	facades.Route().Post("/api/webservers/redirects", webServersController.SaveSystemRedirects)
	facades.Route().Get("/api/webservers/conf/roots", webServersController.ConfRoots)
	facades.Route().Get("/api/webservers/conf/list", webServersController.ConfList)
	facades.Route().Get("/api/webservers/conf/file", webServersController.ConfRead)
	facades.Route().Post("/api/webservers/conf/file", webServersController.ConfSave)
	facades.Route().Post("/api/webservers/conf/delete", webServersController.ConfDelete)
	facades.Route().Post("/api/webservers/conf/test", webServersController.ConfTest)
	facades.Route().Get("/api/webservers/defaults", webServersController.MainConf)
	facades.Route().Post("/api/webservers/defaults", webServersController.SaveMainConf)
	facades.Route().Post("/api/webservers/pools/rewrite", webServersController.RewritePools)
	facades.Route().Post("/api/webservers/library", webServersController.SaveVhostLibrary)
	facades.Route().Post("/api/webservers/library/delete", webServersController.DeleteVhostLibrary)
	facades.Route().Post("/api/webservers/mode", webServersController.SwitchMode)
	facades.Route().Post("/api/webservers/php-defaults", webServersController.SetPHPDefaults)
	facades.Route().Get("/api/webservers/profiles", webServersController.Profiles)
	facades.Route().Post("/api/webservers/profile", webServersController.SwitchProfile)
	facades.Route().Get("/api/webservers/services", webServersController.Services)
	facades.Route().Post("/api/webservers/service/action", webServersController.ControlService)
	facades.Route().Get("/api/webservers/templates", webServersController.TemplateFiles)
	facades.Route().Get("/api/webservers/template", webServersController.GetTemplate)
	facades.Route().Post("/api/webservers/template", webServersController.SaveTemplate)
	facades.Route().Post("/api/webservers/template/reset", webServersController.ResetTemplate)
	facades.Route().Get("/api/webservers/main-configs", webServersController.MainConfigs)
	facades.Route().Post("/api/webservers/main-configs", webServersController.SaveMainConfig)
	facades.Route().Get("/api/webservers/domain-vhost", webServersController.DomainVhost)
	facades.Route().Post("/api/webservers/domain-vhost", webServersController.SaveDomainVhost)
	facades.Route().Post("/api/webservers/rebuild", webServersController.RebuildAll)
	facades.Route().Get("/api/webservers/apache-status", webServersController.ApacheStatus)
}
