package controllers

import (
	"fmt"

	"github.com/goravel/framework/contracts/http"
	"goravel/app/services"
)

type WebServersController struct {
	webServerService *services.WebServerManagerService
}

func NewWebServersController() *WebServersController {
	return &WebServersController{
		webServerService: services.NewWebServerManagerService(),
	}
}

// Profiles returns the 5 WebServer profiles
func (r *WebServersController) Profiles(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   r.webServerService.GetProfiles(),
	})
}

// SwitchProfile switches global server profile
func (r *WebServersController) SwitchProfile(ctx http.Context) http.Response {
	profileID := ctx.Request().Input("profile_id")
	if profileID == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "profile_id is required",
		})
	}

	if err := r.webServerService.SwitchGlobalProfile(profileID); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Server profile switched to '%s' successfully", profileID),
	})
}

// Services returns real-time status of Nginx, Apache, Varnish, PHP-FPM
func (r *WebServersController) Services(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   r.webServerService.GetServicesState(),
	})
}

// ControlService starts, stops, restarts, or reloads a service
func (r *WebServersController) ControlService(ctx http.Context) http.Response {
	serviceName := ctx.Request().Input("service")
	action := ctx.Request().Input("action")

	if serviceName == "" || action == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "service and action are required",
		})
	}

	if err := r.webServerService.ControlService(serviceName, action); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Service '%s' %sed successfully", serviceName, action),
	})
}

// TemplateFiles lists all available Vhost templates
func (r *WebServersController) TemplateFiles(ctx http.Context) http.Response {
	files, err := r.webServerService.GetTemplateFiles()
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   files,
	})
}

// GetTemplate reads a specific template file
func (r *WebServersController) GetTemplate(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine")
	filename := ctx.Request().Input("filename")

	content, err := r.webServerService.ReadTemplateFile(engine, filename)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"content": content,
	})
}

// SaveTemplate updates a specific template file
func (r *WebServersController) SaveTemplate(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine")
	filename := ctx.Request().Input("filename")
	content := ctx.Request().Input("content")

	if err := r.webServerService.SaveTemplateFile(engine, filename, content); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Template %s/%s updated successfully", engine, filename),
	})
}
