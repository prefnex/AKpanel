package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerIPsRoutes(ipsController *controllers.IPsController) {
	// IP Management API (IPv4 & IPv6 Pool, Interface Binding, Roles)
	facades.Route().Get("/api/ips", ipsController.Index)
	facades.Route().Post("/api/ips", ipsController.Store)
	facades.Route().Post("/api/ips/delete", ipsController.Destroy)
	facades.Route().Post("/api/ips/set-role", ipsController.SetRole)
}
