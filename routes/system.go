package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerSystemRoutes(dashboardController *controllers.DashboardController) {
	// System & Dashboard API
	facades.Route().Get("/api/system/stats", dashboardController.Stats)
}
