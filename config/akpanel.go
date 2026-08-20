package config

import (
	"goravel/app/facades"
)

func init() {
	config := facades.Config()
	config.Add("akpanel", map[string]any{
		"sites_root":          config.Env("SITES_ROOT", "/var/www/sites"),
		"user_homes":          config.Env("USER_HOMES", "/home"),
		"server_profile":      config.Env("SERVER_PROFILE", "nginx_phpfpm"),
		"mysql_root_password": config.Env("MYSQL_ROOT_PASSWORD", "akpanel123"),
		"admin_port":          config.Env("APP_PORT", 2087),
		"client_port":         config.Env("CLIENT_PORT", 2083),
	})
}
