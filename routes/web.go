package routes

import (
	"fmt"
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/http/controllers"
	"goravel/app/http/middleware"
	"goravel/app/services"
)

func Web() {
	dashboardController := controllers.NewDashboardController()
	websitesController := controllers.NewWebsitesController()
	phpController := controllers.NewPHPController()
	webServersController := controllers.NewWebServersController()
	databasesController := controllers.NewDatabasesController()
	filesController := controllers.NewFilesController()
	securityController := controllers.NewSecurityController()
	terminalController := controllers.NewTerminalController()
	phpMyAdminController := controllers.NewPhpMyAdminController()
	authController := controllers.NewAuthController()
	packagesController := controllers.NewPackagesController()
	usersController := controllers.NewUsersController()
	dnsController := controllers.NewDNSController()
	emailController := controllers.NewEmailController()
	clientController := controllers.NewClientController()
	ipsController := controllers.NewIPsController()
	serverSettingsController := controllers.NewServerSettingsController()
	varnishService := services.NewVarnishService()

	authMiddleware := middleware.NewAuthMiddleware()
	clientAuthMiddleware := middleware.NewClientAuthMiddleware()

	// Register Global Auth Middleware for full endpoint protection
	facades.Route().GlobalMiddleware(authMiddleware)
	facades.Route().GlobalMiddleware(clientAuthMiddleware)

	// Handler to serve the React SPA for any frontend route
	serveSPA := func(ctx http.Context) http.Response {
		return ctx.Response().View().Make("dashboard.tmpl", map[string]any{
			"version": "v1.0.0",
		})
	}

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

	// Direct Webmail launcher (Redirects to Roundcube on standard port or host)
	facades.Route().Get("/webmail", func(ctx http.Context) http.Response {
		host := ctx.Request().Header("X-Forwarded-Host", "")
		if host == "" {
			host = ctx.Request().Header("x-forwarded-host", "")
		}
		if host == "" {
			host = ctx.Request().Header("Host", "")
		}
		if host == "" {
			host = ctx.Request().Header("host", "")
		}
		if host == "" {
			host = ctx.Request().Ip()
		}
		hostname := strings.Split(host, ":")[0]
		if hostname == "" || hostname == "localhost" || hostname == "127.0.0.1" {
			hostname = services.NewDNSService().GetSystemIP()
		}
		return ctx.Response().Redirect(302, fmt.Sprintf("http://%s/webmail/", hostname))
	})

	// Fallback route: Serves SPA shell for any unmapped URL so React Router renders NotFoundPage
	facades.Route().Fallback(serveSPA)

	// Auth APIs
	facades.Route().Post("/api/auth/login", authController.Login)
	facades.Route().Get("/api/auth/me", authController.Me)
	facades.Route().Post("/api/auth/change-password", authController.ChangePassword)

	// Hosting Packages & Resource Quotas API
	facades.Route().Get("/api/packages", packagesController.Index)
	facades.Route().Post("/api/packages", packagesController.Store)
	facades.Route().Post("/api/packages/delete", packagesController.Destroy)

	// IP Management API (IPv4 & IPv6 Pool, Interface Binding, Roles)
	facades.Route().Get("/api/ips", ipsController.Index)
	facades.Route().Post("/api/ips", ipsController.Store)
	facades.Route().Post("/api/ips/delete", ipsController.Destroy)
	facades.Route().Post("/api/ips/set-role", ipsController.SetRole)

	// Server & CWP Settings API (Hostname & Hostname SSL)
	facades.Route().Get("/api/settings/server", serverSettingsController.GetSettings)
	facades.Route().Post("/api/settings/server", serverSettingsController.SaveSettings)
	facades.Route().Post("/api/settings/hostname-ssl", serverSettingsController.IssueHostnameSSL)

	// Multi-Tenant User Accounts Management API
	facades.Route().Get("/api/users", usersController.Index)
	facades.Route().Post("/api/users", usersController.Store)
	facades.Route().Post("/api/users/update", usersController.Update)
	facades.Route().Post("/api/users/suspend", usersController.Suspend)
	facades.Route().Post("/api/users/unsuspend", usersController.Unsuspend)
	facades.Route().Post("/api/users/reset-password", usersController.ResetPassword)
	facades.Route().Post("/api/users/fix-permissions", usersController.FixPermissions)
	facades.Route().Post("/api/users/change-package", usersController.ChangePackage)
	facades.Route().Post("/api/users/delete", usersController.Destroy)

	// Global SSL Management API
	facades.Route().Get("/api/ssl/certificates", securityController.Certificates)
	facades.Route().Post("/api/ssl/renew-all", securityController.RenewAll)
	facades.Route().Post("/api/ssl/custom", securityController.InstallCustom)

	// DNS Root Server, BIND 9 Engine, Zones & Security Management API
	facades.Route().Get("/api/dns/zones", dnsController.Index)
	facades.Route().Get("/api/dns/zone", dnsController.GetZone)
	facades.Route().Post("/api/dns/zone/create", dnsController.CreateZone)
	facades.Route().Post("/api/dns/zone/delete", dnsController.DeleteZone)
	facades.Route().Post("/api/dns/record", dnsController.StoreRecord)
	facades.Route().Post("/api/dns/record/delete", dnsController.DeleteRecord)
	facades.Route().Post("/api/dns/zone/reset", dnsController.ResetZone)
	facades.Route().Get("/api/dns/settings", dnsController.GetSettings)
	facades.Route().Post("/api/dns/settings", dnsController.SaveSettings)
	facades.Route().Post("/api/dns/hostname", dnsController.UpdateHostname)
	facades.Route().Get("/api/dns/zone/raw", dnsController.ExportRawZone)
	facades.Route().Post("/api/dns/zone/raw", dnsController.SaveRawZone)
	facades.Route().Post("/api/dns/cloudflare/sync", dnsController.SyncCloudflare)
	facades.Route().Get("/api/dns/server/status", dnsController.GetBindDaemon)
	facades.Route().Post("/api/dns/server/control", dnsController.ControlBind)
	facades.Route().Post("/api/dns/server/rebuild", dnsController.RebuildZones)
	facades.Route().Get("/api/dns/server/options", dnsController.GetBindOptions)
	facades.Route().Post("/api/dns/server/options", dnsController.SaveBindOptions)
	facades.Route().Get("/api/dns/server/logs", dnsController.GetBindLogs)
	facades.Route().Get("/api/dns/template", dnsController.GetTemplate)
	facades.Route().Get("/api/dns/templates", dnsController.ListTemplates)
	facades.Route().Post("/api/dns/template", dnsController.SaveTemplate)
	facades.Route().Post("/api/dns/template/delete", dnsController.DeleteTemplate)
	facades.Route().Post("/api/dns/template/default", dnsController.SetDefaultTemplate)
	facades.Route().Post("/api/dns/zone/apply-template", dnsController.ApplyTemplate)
	facades.Route().Post("/api/dns/zone/owner", dnsController.ChangeZoneOwner)
	facades.Route().Post("/api/dns/bulk-migrate-ip", dnsController.BulkMigrateIP)
	facades.Route().Post("/api/dns/diagnose", dnsController.Diagnose)
	facades.Route().Get("/api/dns/dnssec", dnsController.GetDNSSEC)
	facades.Route().Post("/api/dns/dnssec/toggle", dnsController.ToggleDNSSEC)
	facades.Route().Get("/api/dns/cluster", dnsController.ListCluster)
	facades.Route().Post("/api/dns/cluster/node", dnsController.SaveClusterNode)
	facades.Route().Post("/api/dns/cluster/node/delete", dnsController.DeleteClusterNode)
	facades.Route().Post("/api/dns/cluster/sync", dnsController.SyncCluster)

	// Email Accounts, Postfix/Dovecot Config, Aliases & Mail Queue Management API
	facades.Route().Get("/api/emails", emailController.Index)
	facades.Route().Post("/api/emails", emailController.Store)
	facades.Route().Post("/api/emails/delete", emailController.Destroy)
	facades.Route().Post("/api/emails/password", emailController.ChangePassword)
	facades.Route().Get("/api/emails/aliases", emailController.Aliases)
	facades.Route().Post("/api/emails/aliases", emailController.StoreAlias)
	facades.Route().Post("/api/emails/aliases/delete", emailController.DestroyAlias)
	facades.Route().Get("/api/emails/config", emailController.GetConfig)
	facades.Route().Post("/api/emails/config", emailController.SaveConfig)
	facades.Route().Get("/api/emails/services", emailController.ServicesStatus)
	facades.Route().Post("/api/emails/services/action", emailController.ControlService)
	facades.Route().Get("/api/emails/queue", emailController.Queue)
	facades.Route().Post("/api/emails/queue/flush", emailController.FlushQueue)
	facades.Route().Post("/api/emails/queue/delete", emailController.DeleteQueue)
	facades.Route().Get("/api/emails/security-report", emailController.SecurityReport)

	// phpMyAdmin Web GUI Reverse Proxy (Forwarding transparently to port 8085)
	facades.Route().Any("/phpmyadmin", phpMyAdminController.Proxy)
	facades.Route().Any("/phpmyadmin/*path", phpMyAdminController.Proxy)
	facades.Route().Any("/index.php", phpMyAdminController.Proxy)
	facades.Route().Any("/url.php", phpMyAdminController.Proxy)
	facades.Route().Any("/themes/*path", phpMyAdminController.Proxy)
	facades.Route().Any("/js/*path", phpMyAdminController.Proxy)

	// Static Assets (Vite build output in public/build)
	facades.Route().Static("public", "./public")

	// System & Dashboard API
	facades.Route().Get("/api/system/stats", dashboardController.Stats)

	// WebServer Profiles & Services Management API
	facades.Route().Get("/api/webservers/profiles", webServersController.Profiles)
	facades.Route().Post("/api/webservers/profile", webServersController.SwitchProfile)
	facades.Route().Get("/api/webservers/services", webServersController.Services)
	facades.Route().Post("/api/webservers/service/action", webServersController.ControlService)
	facades.Route().Get("/api/webservers/templates", webServersController.TemplateFiles)
	facades.Route().Get("/api/webservers/template", webServersController.GetTemplate)
	facades.Route().Post("/api/webservers/template", webServersController.SaveTemplate)
	facades.Route().Get("/api/webservers/main-configs", webServersController.MainConfigs)
	facades.Route().Post("/api/webservers/main-configs", webServersController.SaveMainConfig)
	facades.Route().Get("/api/webservers/domain-vhost", webServersController.DomainVhost)
	facades.Route().Post("/api/webservers/domain-vhost", webServersController.SaveDomainVhost)
	facades.Route().Post("/api/webservers/rebuild", webServersController.RebuildAll)
	facades.Route().Get("/api/webservers/apache-status", webServersController.ApacheStatus)

	// PHP Multi-Version & Extensions Management API
	facades.Route().Get("/api/php/versions", phpController.Index)
	facades.Route().Get("/api/php/info", phpController.PHPInfo)
	facades.Route().Get("/api/php/ini/raw", phpController.GetRawIni)
	facades.Route().Post("/api/php/ini/raw", phpController.SaveRawIni)
	facades.Route().Get("/api/php/fpm/pool", phpController.GetFpmPool)
	facades.Route().Post("/api/php/fpm/pool", phpController.SaveFpmPool)
	facades.Route().Post("/api/php/install", phpController.InstallVersion)
	facades.Route().Post("/api/php/install/live", phpController.StartLiveInstall)
	facades.Route().Get("/api/php/task/status", phpController.GetTaskStatus)
	facades.Route().Post("/api/php/extension", phpController.ToggleExtension)
	facades.Route().Post("/api/php/ini", phpController.UpdateIni)
	facades.Route().Post("/api/php/fpm/restart", phpController.RestartFPM)

	// Templates API (The 10 pre-configured templates)
	facades.Route().Get("/api/templates", websitesController.Templates)

	// Websites Management API
	facades.Route().Get("/api/websites", websitesController.Index)
	facades.Route().Post("/api/websites", websitesController.Store)
	facades.Route().Post("/api/websites/switch-engine", websitesController.SwitchEngine)
	facades.Route().Post("/api/websites/delete", websitesController.Destroy)
	facades.Route().Delete("/api/websites", websitesController.Destroy)

	// Database Management API (Multi-Engine Suite)
	facades.Route().Get("/api/databases", databasesController.Index)
	facades.Route().Post("/api/databases", databasesController.Store)
	facades.Route().Post("/api/databases/delete", databasesController.Destroy)
	facades.Route().Post("/api/databases/query", databasesController.Query)
	facades.Route().Post("/api/databases/engine/control", databasesController.EngineControl)
	facades.Route().Post("/api/databases/install/live", databasesController.StartLiveInstall)
	facades.Route().Get("/api/databases/install/status", databasesController.GetTaskStatus)
	facades.Route().Get("/api/databases/versions", databasesController.GetVersions)
	facades.Route().Post("/api/databases/versions/switch", databasesController.SwitchVersion)
	facades.Route().Get("/api/databases/phpmyadmin/config", databasesController.GetPhpMyAdminConfig)
	facades.Route().Post("/api/databases/phpmyadmin/config", databasesController.SavePhpMyAdminConfig)
	facades.Route().Get("/api/databases/phpmyadmin/sso", databasesController.GetPhpMyAdminSSO)
	facades.Route().Get("/api/databases/config", databasesController.GetConfig)
	facades.Route().Post("/api/databases/config", databasesController.SaveConfig)
	facades.Route().Get("/api/databases/logs", databasesController.GetLogs)
	facades.Route().Get("/api/databases/users", databasesController.ListUsers)
	facades.Route().Post("/api/databases/users", databasesController.CreateUser)
	facades.Route().Post("/api/databases/users/delete", databasesController.DeleteUser)
	facades.Route().Post("/api/redis/flush", databasesController.FlushRedis)

	// File Manager API (Full Server Explorer Suite)
	facades.Route().Get("/api/files", filesController.Index)
	facades.Route().Get("/api/files/subdirs", filesController.Subdirs)
	facades.Route().Get("/api/files/read", filesController.Read)
	facades.Route().Post("/api/files/save", filesController.Save)
	facades.Route().Post("/api/files/create", filesController.Create)
	facades.Route().Post("/api/files/delete", filesController.Destroy)
	facades.Route().Post("/api/files/rename", filesController.Rename)
	facades.Route().Post("/api/files/copy", filesController.Copy)
	facades.Route().Post("/api/files/move", filesController.Move)
	facades.Route().Post("/api/files/duplicate", filesController.Duplicate)
	facades.Route().Post("/api/files/archive", filesController.Archive)
	facades.Route().Post("/api/files/extract", filesController.Extract)
	facades.Route().Post("/api/files/remote-download", filesController.RemoteDownload)
	facades.Route().Post("/api/files/grep", filesController.Grep)
	facades.Route().Get("/api/files/checksum", filesController.Checksum)
	facades.Route().Get("/api/files/dirsize", filesController.DirSize)
	facades.Route().Post("/api/files/chmod", filesController.Chmod)
	facades.Route().Post("/api/files/permissions", filesController.FixPermissions)
	facades.Route().Get("/api/files/download", filesController.Download)
	facades.Route().Post("/api/files/upload", filesController.Upload)

	// Security & Firewall API
	facades.Route().Post("/api/security/ssl", securityController.IssueSSL)
	facades.Route().Get("/api/security/firewall", securityController.Firewall)
	facades.Route().Post("/api/security/firewall/toggle", securityController.TogglePort)
	facades.Route().Post("/api/security/firewall/rule", securityController.AddRule)
	facades.Route().Delete("/api/security/firewall/rule", securityController.DeleteRule)
	facades.Route().Post("/api/security/firewall/toggle-enabled", securityController.ToggleFirewall)
	facades.Route().Post("/api/security/firewall/unban", securityController.UnbanIP)
	facades.Route().Post("/api/security/firewall/ban", securityController.BanIP)

	// Web Terminal API
	facades.Route().Post("/api/terminal/exec", terminalController.Execute)

	// Varnish Cache API
	facades.Route().Post("/api/varnish/purge", func(ctx http.Context) http.Response {
		pattern := ctx.Request().Input("pattern", ".*")
		if err := varnishService.PurgeCache(pattern); err != nil {
			return ctx.Response().Status(500).Json(http.Json{
				"status":  "error",
				"message": "Failed to purge Varnish cache: " + err.Error(),
			})
		}
		return ctx.Response().Success().Json(http.Json{
			"status":  "success",
			"message": "Varnish RAM cache purged successfully!",
		})
	})

	// =========================================================================
	// TENANT / CLIENT USER HOSTING CONTROL PANEL APIS (Port 2083)
	// =========================================================================
	facades.Route().Post("/api/client/auth/login", clientController.Login)
	facades.Route().Get("/api/client/auth/me", clientController.Me)
	facades.Route().Get("/api/client/stats", clientController.Stats)
	facades.Route().Get("/api/client/overview", clientController.Stats)
	facades.Route().Get("/api/client/websites", clientController.Websites)
	facades.Route().Post("/api/client/websites", clientController.StoreWebsite)
	facades.Route().Post("/api/client/websites/delete", clientController.DeleteWebsite)
	facades.Route().Get("/api/client/dns", clientController.DNSZones)
	facades.Route().Get("/api/client/dns/zones", clientController.DNSZones)
	facades.Route().Post("/api/client/dns/record", clientController.StoreDNSRecord)
	facades.Route().Post("/api/client/dns/record/delete", clientController.DeleteDNSRecord)
	facades.Route().Get("/api/client/databases", clientController.Databases)
	facades.Route().Post("/api/client/databases", clientController.StoreDatabase)
	facades.Route().Post("/api/client/databases/delete", clientController.DeleteDatabase)
	// Jailed File Manager v2 APIs
	facades.Route().Get("/api/client/files", clientController.Files)
	facades.Route().Get("/api/client/files/read", clientController.ReadFile)
	facades.Route().Post("/api/client/files/save", clientController.SaveFile)
	facades.Route().Post("/api/client/files/create", clientController.CreateFile)
	facades.Route().Post("/api/client/files/mkdir", clientController.CreateFolder)
	facades.Route().Post("/api/client/files/delete", clientController.DeleteFile)
	facades.Route().Post("/api/client/files/rename", clientController.RenameFile)
	facades.Route().Post("/api/client/files/chmod", clientController.ChmodFile)
	facades.Route().Post("/api/client/files/extract", clientController.ExtractArchive)
	facades.Route().Post("/api/client/files/compress", clientController.CompressArchive)
	facades.Route().Get("/api/client/files/search", clientController.SearchFiles)
	facades.Route().Post("/api/client/files/git-clone", clientController.GitClone)

	// FTP Accounts APIs
	facades.Route().Get("/api/client/ftp", clientController.FTPUsers)
	facades.Route().Post("/api/client/ftp/create", clientController.StoreFTPUser)
	facades.Route().Post("/api/client/ftp/delete", clientController.DeleteFTPUser)

	// Cron Jobs APIs
	facades.Route().Get("/api/client/cron", clientController.CronJobs)
	facades.Route().Post("/api/client/cron/create", clientController.StoreCronJob)
	facades.Route().Post("/api/client/cron/delete", clientController.DeleteCronJob)
	facades.Route().Post("/api/client/cron/toggle", clientController.ToggleCronJob)

	// PHP Runtime & phpMyAdmin SSO APIs
	facades.Route().Get("/api/client/php/config", clientController.PHPConfig)
	facades.Route().Get("/api/client/phpmyadmin/sso", clientController.PhpMyAdminSSO)

	// Email & Backups APIs
	facades.Route().Get("/api/client/emails", clientController.Emails)
	facades.Route().Post("/api/client/emails", clientController.StoreEmail)
	facades.Route().Get("/api/client/backups", clientController.Backups)
	facades.Route().Post("/api/client/backups/generate", clientController.GenerateBackup)
}
