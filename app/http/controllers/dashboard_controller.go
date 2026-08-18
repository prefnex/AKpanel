package controllers

import (
	"github.com/goravel/framework/contracts/http"
	"goravel/app/services"
)

type DashboardController struct {
	systemService *services.SystemService
}

func NewDashboardController() *DashboardController {
	return &DashboardController{
		systemService: services.NewSystemService(),
	}
}

// Stats returns full real-time CPU, RAM, Disk, Uptime, and service status metrics
func (r *DashboardController) Stats(ctx http.Context) http.Response {
	stats, err := r.systemService.GetStats()
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   stats,
	})
}
