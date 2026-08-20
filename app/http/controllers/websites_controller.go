package controllers

import (
	"context"
	"fmt"
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/domain"
	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services"
	"goravel/app/services/provisioning"
)

type WebsitesController struct {
	orchestrator    *provisioning.ProvisioningOrchestrator
	templateService *services.TemplateService
}

func NewWebsitesController() *WebsitesController {
	return &WebsitesController{
		orchestrator:    provisioning.GetOrchestrator(),
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

// Store creates a new website via the Provisioning Orchestrator
func (r *WebsitesController) Store(ctx http.Context) http.Response {
	domainName := strings.ToLower(strings.TrimSpace(ctx.Request().Input("domain")))
	serverEngine := ctx.Request().Input("server_engine", "nginx")
	templateID := ctx.Request().Input("template_id", "laravel")
	phpVersion := ctx.Request().Input("php_version", "8.2")
	siteType := ctx.Request().Input("site_type", "php")
	proxyPort := ctx.Request().InputInt("proxy_port", 3000)

	if domainName == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain name is required",
		})
	}

	engine, _ := domain.NormalizeEngine(serverEngine)

	plan := &provisioning.ProvisionPlan{
		Domain:        domainName,
		OwnerUsername: "root",
		PackageID:     "default",
		Engine:        engine,
		PHPVersion:    phpVersion,
		TemplateID:    templateID,
		SiteType:      siteType,
		ProxyPort:     proxyPort,
		CreateDNS:     true,
		CreateSSL:     false,
	}

	website, err := r.orchestrator.ProvisionWebsite(context.Background(), plan)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Provisioning failed: " + err.Error(),
		})
	}

	return ctx.Response().Status(201).Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Website '%s' created successfully using %s (%s)", domainName, strings.ToUpper(string(engine)), templateID),
		"data":    website,
	})
}

// SwitchEngine dynamically switches a website between Nginx, Apache, and Hybrid
func (r *WebsitesController) SwitchEngine(ctx http.Context) http.Response {
	domainName := ctx.Request().Input("domain")
	newEngine := ctx.Request().Input("server_engine")

	if domainName == "" || newEngine == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain and server_engine are required",
		})
	}

	var website models.Website
	if err := facades.Orm().Query().Where("domain = ?", domainName).First(&website); err != nil {
		return ctx.Response().Status(404).Json(http.Json{
			"status":  "error",
			"message": "Website not found in database",
		})
	}

	engine, err := domain.NormalizeEngine(newEngine)
	if err != nil {
		engine = domain.EngineNginx
	}

	nginxSvc := services.NewNginxService()
	cfg := services.WebsiteConfig{
		Domain:       website.Domain,
		ServerEngine: string(engine),
		TemplateID:   website.TemplateID,
		PHPVersion:   website.PHPVersion,
		SiteType:     website.SiteType,
		ProxyPort:    website.ProxyPort,
		RootPath:     website.RootPath,
	}

	if err := nginxSvc.CreateWebsite(cfg); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to switch web engine: " + err.Error(),
		})
	}

	website.ServerEngine = string(engine)
	_ = facades.Orm().Query().Save(&website)

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Engine for '%s' switched to %s successfully", domainName, strings.ToUpper(string(engine))),
		"data":    website,
	})
}

// Destroy deletes a website via the Provisioning Orchestrator
func (r *WebsitesController) Destroy(ctx http.Context) http.Response {
	domainName := ctx.Request().Input("domain")
	if domainName == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain name is required",
		})
	}

	if err := r.orchestrator.DeprovisionWebsite(context.Background(), domainName); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to delete website: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Website '%s' deleted successfully", domainName),
	})
}
