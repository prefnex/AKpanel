package routes

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/services"
)

func registerVarnishRoutes(varnishService *services.VarnishService) {
	// Varnish Cache API
	facades.Route().Post("/api/varnish/purge", func(ctx http.Context) http.Response {
		pattern := ctx.Request().Input("pattern", ".*")
		if err := varnishService.PurgeCache(pattern); err != nil {
			return ctx.Response().Status(500).Json(http.Json{
				"status":  "error",
				"message": "Failed to purge Varnish cache: " + err.Error(),
			})
		}
		return ctx.Response().Success().Json(http.Json{
			"status":  "success",
			"message": "Varnish RAM cache purged successfully!",
		})
	})
}
