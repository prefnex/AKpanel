package controllers

import (
	"fmt"
	"strings"

	"github.com/goravel/framework/contracts/http"
	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services"
)

type WebsitesController struct {
	nginxService    *services.NginxService
	templateService *services.TemplateService
}

func NewWebsitesController() *WebsitesController {
	return &WebsitesController{
		nginxService:    services.NewNginxService(),
		templateService: services.NewTemplateService(),
	}
}

// Templates returns the 10 pre-configured industry templates
func (r *WebsitesController) Templates(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   r.templateService.GetTemplates(),
	})
}

// Index lists all websites
func (r *WebsitesController) Index(ctx http.Context) http.Response {
	var websites []models.Website
	if err := facades.Orm().Query().OrderByDesc("created_at").Find(&websites); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to fetch websites: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   websites,
	})
}

// Store creates a new website with virtual host and template
func (r *WebsitesController) Store(ctx http.Context) http.Response {
	domain := strings.ToLower(strings.TrimSpace(ctx.Request().Input("domain")))
	serverEngine := ctx.Request().Input("server_engine", "nginx")
	templateID := ctx.Request().Input("template_id", "laravel")
	phpVersion := ctx.Request().Input("php_version", "8.2")
	siteType := ctx.Request().Input("site_type", "php")
	proxyPort := ctx.Request().InputInt("proxy_port", 3000)

	if domain == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain name is required",
		})
	}

	// Check if already exists in DB
	count, _ := facades.Orm().Query().Model(&models.Website{}).Where("domain = ?", domain).Count()
	if count > 0 {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": fmt.Sprintf("Website '%s' already exists", domain),
		})
	}

	cfg := services.WebsiteConfig{
		Domain:       domain,
		ServerEngine: serverEngine,
		TemplateID:   templateID,
		PHPVersion:   phpVersion,
		SiteType:     siteType,
		ProxyPort:    proxyPort,
	}

	// 1. Create Web Server Virtual Host & Directories
	if err := r.nginxService.CreateWebsite(cfg); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to configure Web Server: " + err.Error(),
		})
	}

	// 2. Save record to DB
	website := models.Website{
		Domain:       domain,
		ServerEngine: serverEngine,
		TemplateID:   templateID,
		PHPVersion:   phpVersion,
		SiteType:     siteType,
		ProxyPort:    proxyPort,
		RootPath:     fmt.Sprintf("/var/www/sites/%s/public", domain),
		SSLActive:    false,
	}

	if err := facades.Orm().Query().Create(&website); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to save website to database: " + err.Error(),
		})
	}

	return ctx.Response().Status(201).Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Website '%s' created successfully using %s (%s)", domain, strings.ToUpper(serverEngine), templateID),
		"data":    website,
	})
}

// SwitchEngine dynamically switches a website between Nginx, Apache, and Hybrid
func (r *WebsitesController) SwitchEngine(ctx http.Context) http.Response {
	domain := ctx.Request().Input("domain")
	newEngine := ctx.Request().Input("server_engine") // "nginx", "apache", "hybrid"

	if domain == "" || newEngine == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain and server_engine are required",
		})
	}

	var website models.Website
	if err := facades.Orm().Query().Where("domain = ?", domain).First(&website); err != nil || website.ID == 0 {
		return ctx.Response().Status(404).Json(http.Json{
			"status":  "error",
			"message": "Website not found",
		})
	}

	cfg := services.WebsiteConfig{
		Domain:       website.Domain,
		ServerEngine: newEngine,
		TemplateID:   website.TemplateID,
		PHPVersion:   website.PHPVersion,
		SiteType:     website.SiteType,
		ProxyPort:    website.ProxyPort,
		RootPath:     website.RootPath,
	}

	if err := r.nginxService.CreateWebsite(cfg); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to switch web engine: " + err.Error(),
		})
	}

	website.ServerEngine = newEngine
	_ = facades.Orm().Query().Save(&website)

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Engine for '%s' switched to %s successfully", domain, strings.ToUpper(newEngine)),
		"data":    website,
	})
}

// Destroy deletes a website
func (r *WebsitesController) Destroy(ctx http.Context) http.Response {
	domain := ctx.Request().Input("domain")
	if domain == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain name is required",
		})
	}

	_ = r.nginxService.DeleteWebsite(domain)

	if _, err := facades.Orm().Query().Where("domain = ?", domain).Delete(&models.Website{}); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to delete website: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Website '%s' deleted successfully", domain),
	})
}
