package controllers

import (
	"fmt"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
	"goravel/app/templates"
)

type WebServersController struct {
	webServerService *services.WebServerManagerService
}

func NewWebServersController() *WebServersController {
	return &WebServersController{
		webServerService: services.NewWebServerManagerService(),
	}
}

// Modes returns the web server modes, the active one and the two default PHP versions.
func (r *WebServersController) Modes(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   r.webServerService.GetModes(),
	})
}

// Profiles is the legacy name of Modes.
func (r *WebServersController) Profiles(ctx http.Context) http.Response {
	return r.Modes(ctx)
}

// SwitchMode applies a mode (rebuilding every vhost) and optionally the default PHP versions.
func (r *WebServersController) SwitchMode(ctx http.Context) http.Response {
	mode := ctx.Request().Input("mode")
	if mode == "" {
		mode = ctx.Request().Input("profile_id")
	}
	if mode == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "mode is required"})
	}
	res, err := r.webServerService.SwitchMode(mode, ctx.Request().Input("default_nginx_php"), ctx.Request().Input("default_apache_php"))
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": "error", "message": err.Error(), "data": res})
	}
	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Web server mode is now %s — %d site(s) rebuilt", res.To, res.Sites),
		"data":    res,
	})
}

// SwitchProfile is the legacy name of SwitchMode.
func (r *WebServersController) SwitchProfile(ctx http.Context) http.Response {
	return r.SwitchMode(ctx)
}

// SetPHPDefaults stores the default PHP version for Nginx- and Apache-run sites.
func (r *WebServersController) SetPHPDefaults(ctx http.Context) http.Response {
	if err := r.webServerService.SetDefaultPHPVersions(ctx.Request().Input("default_nginx_php"), ctx.Request().Input("default_apache_php")); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Default PHP versions saved", "data": r.webServerService.GetModes()})
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

// TemplateFiles lists every vhost template and whether it is overridden.
func (r *WebServersController) TemplateFiles(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   r.webServerService.GetTemplateFiles(),
	})
}

// GetTemplate returns a template's effective text and the shipped default.
func (r *WebServersController) GetTemplate(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine")
	filename := ctx.Request().Input("filename")
	content, overridden, err := r.webServerService.ReadTemplateFile(engine, filename)
	if err != nil {
		return ctx.Response().Status(404).Json(http.Json{"status": "error", "message": err.Error()})
	}
	def, _ := templates.Default(engine, filename)
	return ctx.Response().Success().Json(http.Json{
		"status":     "success",
		"content":    content,
		"overridden": overridden,
		"default":    def,
	})
}

// SaveTemplate stores an override and rebuilds every vhost (rolled back if it breaks).
func (r *WebServersController) SaveTemplate(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine")
	filename := ctx.Request().Input("filename")
	content := ctx.Request().Input("content")
	if err := r.webServerService.SaveTemplateFile(engine, filename, content); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Template %s/%s saved and every vhost rebuilt", engine, filename),
	})
}

// ResetTemplate drops an override and rebuilds.
func (r *WebServersController) ResetTemplate(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine")
	filename := ctx.Request().Input("filename")
	if err := r.webServerService.ResetTemplateFile(engine, filename); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Template %s/%s reset to the shipped version", engine, filename),
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
	nginxConf := ctx.Request().Input("nginx_custom")
	apacheConf := ctx.Request().Input("apache_custom")

	if domain == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "domain is required",
		})
	}

	if err := r.webServerService.SaveDomainVhost(domain, nginxConf, apacheConf); err != nil {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Custom directives for '%s' saved and applied", domain),
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
