package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerSSLRoutes(securityController *controllers.SecurityController) {
	// Global SSL Management API
	facades.Route().Get("/api/ssl/certificates", securityController.Certificates)
	facades.Route().Post("/api/ssl/renew-all", securityController.RenewAll)
	facades.Route().Post("/api/ssl/custom", securityController.InstallCustom)
}

func registerFirewallRoutes(securityController *controllers.SecurityController) {
	// Security & Firewall API
	facades.Route().Post("/api/security/ssl", securityController.IssueSSL)
	facades.Route().Get("/api/security/firewall", securityController.Firewall)
	facades.Route().Post("/api/security/firewall/toggle", securityController.TogglePort)
	facades.Route().Post("/api/security/firewall/rule", securityController.AddRule)
	facades.Route().Delete("/api/security/firewall/rule", securityController.DeleteRule)
	facades.Route().Post("/api/security/firewall/toggle-enabled", securityController.ToggleFirewall)
	facades.Route().Post("/api/security/firewall/unban", securityController.UnbanIP)
	facades.Route().Post("/api/security/firewall/ban", securityController.BanIP)
}
