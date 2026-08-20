package routes

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
)

// serveSPA renders the React SPA shell for browser routes and the fallback handler.
func serveSPA(ctx http.Context) http.Response {
	return ctx.Response().View().Make("dashboard.tmpl", map[string]any{
		"version": "v1.0.0",
	})
}

func registerSPARoutes() {
	// Browser SPA Routes (Allows direct URLs & browser refresh on any tab)
	facades.Route().Get("/", serveSPA)
	facades.Route().Get("/login", serveSPA)
	facades.Route().Get("/users", serveSPA)
	facades.Route().Get("/packages", serveSPA)
	facades.Route().Get("/ips", serveSPA)
	facades.Route().Get("/settings", serveSPA)
	facades.Route().Get("/settings/server", serveSPA)
	facades.Route().Get("/dns", serveSPA)
	facades.Route().Get("/dns/zones", serveSPA)
	facades.Route().Get("/dns/server", serveSPA)
	facades.Route().Get("/dns/nameservers", serveSPA)
	facades.Route().Get("/dns/templates", serveSPA)
	facades.Route().Get("/dns/cluster", serveSPA)
	facades.Route().Get("/dns/security", serveSPA)
	facades.Route().Get("/dns/sync", serveSPA)
	facades.Route().Get("/emails", serveSPA)
	facades.Route().Get("/emails/accounts", serveSPA)
	facades.Route().Get("/emails/aliases", serveSPA)
	facades.Route().Get("/emails/autoresponders", serveSPA)
	facades.Route().Get("/emails/routing", serveSPA)
	facades.Route().Get("/emails/queue", serveSPA)
	facades.Route().Get("/emails/server", serveSPA)
	facades.Route().Get("/emails/dkim", serveSPA)
	facades.Route().Get("/emails/antispam", serveSPA)
	facades.Route().Get("/webservers", serveSPA)
	facades.Route().Get("/webservers/select", serveSPA)
	facades.Route().Get("/webservers/main-conf", serveSPA)
	facades.Route().Get("/webservers/domain-conf", serveSPA)
	facades.Route().Get("/webservers/templates", serveSPA)
	facades.Route().Get("/webservers/conf-editor", serveSPA)
	facades.Route().Get("/webservers/apache-status", serveSPA)
	facades.Route().Get("/webservers/rebuild", serveSPA)
	facades.Route().Get("/webservers/redirects", serveSPA)
	facades.Route().Get("/php", serveSPA)
	facades.Route().Get("/dashboard", serveSPA)
	facades.Route().Get("/websites", serveSPA)
	facades.Route().Get("/templates", serveSPA)
	facades.Route().Get("/databases", serveSPA)
	facades.Route().Get("/databases/mysql", serveSPA)
	facades.Route().Get("/databases/postgres", serveSPA)
	facades.Route().Get("/databases/mongodb", serveSPA)
	facades.Route().Get("/databases/redis", serveSPA)
	facades.Route().Get("/filemanager", serveSPA)
	facades.Route().Get("/ssl", serveSPA)
	facades.Route().Get("/terminal", serveSPA)
	facades.Route().Get("/security", serveSPA)
	facades.Route().Get("/firewall", serveSPA)
}
