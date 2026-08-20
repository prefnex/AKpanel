package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerPackagesRoutes(packagesController *controllers.PackagesController) {
	// Hosting Packages & Resource Quotas API
	facades.Route().Get("/api/packages", packagesController.Index)
	facades.Route().Post("/api/packages", packagesController.Store)
	facades.Route().Post("/api/packages/delete", packagesController.Destroy)
}
