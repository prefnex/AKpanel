package models

import (
	"github.com/goravel/framework/database/orm"
)

type Website struct {
	orm.Model
	Domain       string `gorm:"column:domain;unique;not null" json:"domain"`
	ServerEngine string `gorm:"column:server_engine;default:'nginx'" json:"server_engine"` // "nginx", "apache", "hybrid"
	TemplateID   string `gorm:"column:template_id;default:'laravel'" json:"template_id"`
	PHPVersion   string `gorm:"column:php_version" json:"php_version"`
	SiteType     string `gorm:"column:site_type" json:"site_type"`
	ProxyPort    int    `gorm:"column:proxy_port" json:"proxy_port"`
	RootPath     string `gorm:"column:root_path" json:"root_path"`
	SSLActive    bool   `gorm:"column:ssl_active" json:"ssl_active"`
}
