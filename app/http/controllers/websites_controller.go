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

// websiteWithStack is a website row plus what its stack resolves to in the current mode.
type websiteWithStack struct {
	models.Website
	Stack    services.SiteResult  `json:"stack"`
	Services []domain.SiteService `json:"services"`
	// Vhost library templates in effect (stored choice or the Main Conf default).
	VhostTemplates []string `json:"vhost_templates"`
}

// Index lists all websites with their requested and effective web stack.
func (r *WebsitesController) Index(ctx http.Context) http.Response {
	var websites []models.Website
	if err := facades.Orm().Query().OrderByDesc("created_at").Find(&websites); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to fetch websites: " + err.Error(),
		})
	}
	stack := services.GetWebStack()
	out := make([]websiteWithStack, 0, len(websites))
	for i := range websites {
		out = append(out, websiteWithStack{
			Website:        websites[i],
			Stack:          stack.SiteStatus(&websites[i]),
			Services:       services.EnabledSiteServicesFor(&websites[i]),
			VhostTemplates: services.SiteVhostTemplateNamesFor(&websites[i]),
		})
	}
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   out,
		"mode":   services.CurrentMode().Info(),
	})
}

// Store creates a new website via the Provisioning Orchestrator
func (r *WebsitesController) Store(ctx http.Context) http.Response {
	domainName := strings.ToLower(strings.TrimSpace(ctx.Request().Input("domain")))
	backend := ctx.Request().Input("backend")
	if backend == "" {
		backend = ctx.Request().Input("server_engine")
	}
	templateID := ctx.Request().Input("template_id", "laravel")
	siteType := ctx.Request().Input("site_type", "php")
	proxyPort := ctx.Request().InputInt("proxy_port", 3000)

	if domainName == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain name is required",
		})
	}

	parsed, varnish := domain.ParseBackend(backend)
	if v := ctx.Request().Input("varnish"); v != "" {
		varnish = domain.ParseVarnish(v)
	}
	plan := &provisioning.ProvisionPlan{
		Domain:        domainName,
		OwnerUsername: "root",
		PackageID:     "default",
		Backend:       parsed,
		PHPHandler:    ctx.Request().Input("php_handler"),
		Varnish:       varnish,
		PHPVersion:    ctx.Request().Input("php_version"),
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

	st := services.GetWebStack().SiteStatus(website)
	return ctx.Response().Status(201).Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Website '%s' created (%s, PHP %s)", domainName, describeStack(st.Effective), website.PHPVersion),
		"data":    websiteWithStack{Website: *website, Stack: st},
	})
}

func describeStack(e domain.EffectiveStack) string {
	s := string(e.Backend)
	if e.Backend == domain.BackendApache && e.SiteType == domain.SiteTypePHP {
		s += " + php-" + string(e.PHPHandler)
	}
	if e.Varnish {
		s += " + varnish"
	}
	return s
}

// UpdateStack changes one domain's web stack (backend, Apache PHP handler, Varnish) within
// what the current mode allows; the request is stored even when the mode overrides it.
func (r *WebsitesController) UpdateStack(ctx http.Context) http.Response {
	domainName := strings.ToLower(strings.TrimSpace(ctx.Request().Input("domain")))
	if domainName == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "domain is required"})
	}
	backend := ctx.Request().Input("backend")
	if backend == "" {
		backend = ctx.Request().Input("server_engine")
	}
	parsed, legacyVarnish := domain.ParseBackend(backend)
	varnish := domain.ParseVarnish(ctx.Request().Input("varnish"))
	if varnish == "" {
		varnish = legacyVarnish
	}
	req := domain.SiteStack{
		Backend:    parsed,
		PHPHandler: domain.ParsePHPHandler(ctx.Request().Input("php_handler")),
		Varnish:    varnish,
		SiteType:   ctx.Request().Input("site_type"),
		ProxyPort:  ctx.Request().InputInt("proxy_port", 0),
		ProxyHost:  strings.TrimSpace(ctx.Request().Input("proxy_host")),
	}
	res, err := services.GetWebStack().SetSiteStack(domainName, req)
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	msg := fmt.Sprintf("%s now runs on %s", domainName, describeStack(res.Effective))
	if len(res.Effective.Notes) > 0 {
		msg += " (" + strings.Join(res.Effective.Notes, "; ") + ")"
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": msg, "data": res})
}

// Services returns one domain's service subdomains (webmail. mail. cpanel. ftp.).
func (r *WebsitesController) Services(ctx http.Context) http.Response {
	domainName := strings.ToLower(strings.TrimSpace(ctx.Request().Query("domain")))
	st, err := services.GetWebStack().SiteServices(domainName)
	if err != nil {
		return ctx.Response().Status(404).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": st})
}

// UpdateServices turns a domain's service subdomains on or off. use_default=true goes back
// to the default for the domain (all four for account domains, webmail and mail for root sites).
func (r *WebsitesController) UpdateServices(ctx http.Context) http.Response {
	domainName := strings.ToLower(strings.TrimSpace(ctx.Request().Input("domain")))
	if domainName == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "domain is required"})
	}
	st, err := services.GetWebStack().SetSiteServices(domainName, ctx.Request().InputArray("services"), ctx.Request().InputBool("use_default"))
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	names := make([]string, 0, len(st.Enabled))
	for _, s := range st.Enabled {
		names = append(names, st.Hosts[string(s)])
	}
	msg := fmt.Sprintf("%s: no service subdomains", domainName)
	if len(names) > 0 {
		msg = fmt.Sprintf("%s now serves %s", domainName, strings.Join(names, ", "))
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": msg, "data": st})
}

// SwitchEngine is the legacy name of UpdateStack.
func (r *WebsitesController) SwitchEngine(ctx http.Context) http.Response {
	return r.UpdateStack(ctx)
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
