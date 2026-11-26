package models

import (
	"github.com/goravel/framework/database/orm"

	"goravel/app/domain"
)

type Website struct {
	orm.Model
	Domain        string `gorm:"column:domain;unique;not null" json:"domain"`
	OwnerUsername string `gorm:"column:owner_username;default:'root'" json:"owner_username"`
	PackageID     string `gorm:"column:package_id" json:"package_id"`
	Status        string `gorm:"column:status;default:'active'" json:"status"` // active, suspended
	// Deprecated: legacy engine string, read only through domain.ParseBackend when Backend is empty.
	ServerEngine string `gorm:"column:server_engine;default:'nginx'" json:"server_engine"`
	// Per-domain stack request (domain.SiteStack); "" = follow the server mode default.
	Backend    string `gorm:"column:backend" json:"backend"`
	PHPHandler string `gorm:"column:php_handler" json:"php_handler"`
	Varnish    string `gorm:"column:varnish" json:"varnish"`
	// Per-domain service subdomains (domain.SiteService, comma list); "" = default, "none" = off.
	Services string `gorm:"column:services" json:"services_raw"`
	// Per-domain vhost library templates (templates.VhostTemplate names, comma list);
	// "" = the Main Conf default, "none" = no templates.
	VhostTemplates string `gorm:"column:vhost_templates" json:"vhost_templates_raw"`
	TemplateID     string `gorm:"column:template_id;default:'laravel'" json:"template_id"`
	PHPVersion     string `gorm:"column:php_version" json:"php_version"`
	SiteType       string `gorm:"column:site_type" json:"site_type"`
	ProxyPort      int    `gorm:"column:proxy_port" json:"proxy_port"`
	ProxyHost      string `gorm:"column:proxy_host" json:"proxy_host"`
	RootPath       string `gorm:"column:root_path" json:"root_path"`
	SSLActive      bool   `gorm:"column:ssl_active" json:"ssl_active"`
}

// StackRequest returns the site's stored stack request, upgrading legacy rows.
func (w *Website) StackRequest() domain.SiteStack {
	backend, varnish := domain.ParseBackend(w.Backend)
	if w.Backend == "" {
		backend, varnish = domain.ParseBackend(w.ServerEngine)
	}
	if w.Varnish != "" {
		varnish = domain.ParseVarnish(w.Varnish)
	}
	return domain.SiteStack{
		SiteType:   w.SiteType,
		Backend:    backend,
		PHPHandler: domain.ParsePHPHandler(w.PHPHandler),
		Varnish:    varnish,
		ProxyPort:  w.ProxyPort,
		ProxyHost:  w.ProxyHost,
	}
}
