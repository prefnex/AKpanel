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
		"message": fmt.Sprintf("Server profile switched to '%s' — all vhosts rebuilt and services reloaded", profileID),
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
	var req struct {
		Service string `json:"service"`
		Action  string `json:"action"`
	}
	_ = ctx.Request().Bind(&req)
	serviceName := req.Service
	if serviceName == "" {
		serviceName = ctx.Request().Input("service")
	}
	action := req.Action
	if action == "" {
		action = ctx.Request().Input("action")
	}

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

// MainConfigs returns all global configuration files for Nginx, Apache, Varnish
func (r *WebServersController) MainConfigs(ctx http.Context) http.Response {
	configs := r.webServerService.GetMainConfigs()
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   configs,
	})
}

// SaveMainConfig updates a global web server configuration file
func (r *WebServersController) SaveMainConfig(ctx http.Context) http.Response {
	filePath := ctx.Request().Input("file_path")
	content := ctx.Request().Input("content")

	if filePath == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "file_path is required",
		})
	}

	if err := r.webServerService.SaveMainConfig(filePath, content); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Configuration file '%s' saved and reloaded successfully!", filePath),
	})
}

// DomainVhost returns Nginx and Apache vhost configurations for a specific domain
func (r *WebServersController) DomainVhost(ctx http.Context) http.Response {
	domain := ctx.Request().Input("domain")
	if domain == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "domain is required",
		})
	}

	vhost := r.webServerService.GetDomainVhost(domain)
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   vhost,
	})
}

// SaveDomainVhost saves custom Nginx & Apache vhost configurations for a specific domain
func (r *WebServersController) SaveDomainVhost(ctx http.Context) http.Response {
	domain := ctx.Request().Input("domain")
	nginxConf := ctx.Request().Input("nginx_conf")
	apacheConf := ctx.Request().Input("apache_conf")

	if domain == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "domain is required",
		})
	}

	if err := r.webServerService.SaveDomainVhost(domain, nginxConf, apacheConf); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("VirtualHost configuration for '%s' saved and applied successfully!", domain),
	})
}

// RebuildAll reloads and recompiles all web server virtual hosts
func (r *WebServersController) RebuildAll(ctx http.Context) http.Response {
	msg, err := r.webServerService.RebuildAllVhosts()
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": msg,
	})
}

// ApacheStatus returns live Apache status scoreboard
func (r *WebServersController) ApacheStatus(ctx http.Context) http.Response {
	data := r.webServerService.GetApacheStatus()
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   data,
		"output": data.RawOutput,
	})
}
