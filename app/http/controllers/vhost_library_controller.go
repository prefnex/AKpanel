package controllers

import (
	"fmt"
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
	"goravel/app/templates"
)

// Vhost template library: named templates (built-in and custom) chosen per domain.

// VhostLibrary lists every library template with the domains that use it.
func (r *WebServersController) VhostLibrary(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": services.GetWebStack().VhostLibrary()})
}

// SaveVhostLibrary creates or edits a custom template and rebuilds the domains using it.
func (r *WebServersController) SaveVhostLibrary(ctx http.Context) http.Response {
	var t templates.VhostTemplate
	if err := ctx.Request().Bind(&t); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "invalid template: " + err.Error()})
	}
	saved, err := services.GetWebStack().SaveVhostTemplate(t)
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	msg := fmt.Sprintf("Template %s saved", saved.Name)
	if n := len(saved.UsedBy); n > 0 {
		msg += fmt.Sprintf(" and %d domain(s) rebuilt", n)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": msg, "data": saved})
}

// DeleteVhostLibrary removes a custom template nobody uses.
func (r *WebServersController) DeleteVhostLibrary(ctx http.Context) http.Response {
	name := strings.TrimSpace(ctx.Request().Input("name"))
	if err := services.GetWebStack().DeleteVhostTemplate(name); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Template " + name + " deleted"})
}

// VhostTemplates returns one domain's library templates.
func (r *WebsitesController) VhostTemplates(ctx http.Context) http.Response {
	domainName := strings.ToLower(strings.TrimSpace(ctx.Request().Query("domain")))
	st, err := services.GetWebStack().SiteVhostTemplates(domainName)
	if err != nil {
		return ctx.Response().Status(404).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": st})
}

// UpdateVhostTemplates sets a domain's library templates (use_default=true: Main Conf default).
func (r *WebsitesController) UpdateVhostTemplates(ctx http.Context) http.Response {
	domainName := strings.ToLower(strings.TrimSpace(ctx.Request().Input("domain")))
	if domainName == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "domain is required"})
	}
	st, err := services.GetWebStack().SetSiteVhostTemplates(domainName, ctx.Request().InputArray("templates"), ctx.Request().InputBool("use_default"))
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	msg := domainName + ": no vhost templates"
	if len(st.Selected) > 0 {
		msg = domainName + " now uses " + strings.Join(st.Selected, ", ")
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": msg, "data": st})
}

// PreviewVhost renders a domain's vhosts with a template list without writing anything.
func (r *WebsitesController) PreviewVhost(ctx http.Context) http.Response {
	domainName := strings.ToLower(strings.TrimSpace(ctx.Request().Input("domain")))
	p, err := services.GetWebStack().PreviewSiteVhost(domainName, ctx.Request().InputArray("templates"))
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": p})
}

// MainConf returns the server-wide defaults (default vhost templates, PHP-FPM pool profile).
func (r *WebServersController) MainConf(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": services.LoadWebServerDefaults()})
}

// SaveMainConf stores the defaults; rebuild=true applies them to existing domains and pools.
func (r *WebServersController) SaveMainConf(ctx http.Context) http.Response {
	var req struct {
		services.WebServerDefaults
		Rebuild bool `json:"rebuild"`
	}
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "invalid request: " + err.Error()})
	}
	res, err := services.GetWebStack().SaveWebServerDefaults(req.WebServerDefaults, req.Rebuild)
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	msg := "Defaults saved: new domains and accounts use them"
	if req.Rebuild {
		msg = fmt.Sprintf("Defaults saved, %d site(s) rebuilt", res.SitesRebuilt)
		if res.PoolsRewritten > 0 {
			msg += fmt.Sprintf(", %d PHP-FPM pool(s) rewritten", res.PoolsRewritten)
		}
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": msg, "data": res})
}

// RewritePools re-renders every account's PHP-FPM pool from the template.
func (r *WebServersController) RewritePools(ctx http.Context) http.Response {
	n, err := services.RewriteAllPools()
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": fmt.Sprintf("%d PHP-FPM pool(s) rewritten", n)})
}

// SystemRedirects returns the redirects every domain answers (/cpanel, /webmail …).
func (r *WebServersController) SystemRedirects(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": services.LoadSystemRedirects(), "defaults": services.DefaultSystemRedirects()})
}

// SaveSystemRedirects stores and applies the list (tested, restored on failure).
func (r *WebServersController) SaveSystemRedirects(ctx http.Context) http.Response {
	var req services.SystemRedirects
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "invalid request"})
	}
	saved, err := services.GetWebStack().SaveSystemRedirects(req)
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": fmt.Sprintf("%d redirect(s) saved and applied", len(saved.Rules)), "data": saved})
}

// StatusInfo reports every web daemon (version, listening addresses, processes) and Apache's
// modules and mod_status figures.
func (r *WebServersController) StatusInfo(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": services.GetWebServerStatus()})
}
