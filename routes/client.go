package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerClientRoutes(clientController *controllers.ClientController) {
	// =========================================================================
	// TENANT / CLIENT USER HOSTING CONTROL PANEL APIS (Port 2083)
	// =========================================================================
	facades.Route().Post("/api/client/auth/login", clientController.Login)
	facades.Route().Get("/api/client/auth/me", clientController.Me)
	facades.Route().Get("/api/client/stats", clientController.Stats)
	facades.Route().Get("/api/client/overview", clientController.Stats)
	facades.Route().Get("/api/client/websites", clientController.Websites)
	facades.Route().Post("/api/client/websites", clientController.StoreWebsite)
	facades.Route().Post("/api/client/websites/docroot", clientController.UpdateWebsiteDocroot)
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
	facades.Route().Delete("/api/client/emails", clientController.DestroyEmail)
	facades.Route().Post("/api/client/emails/delete", clientController.DestroyEmail)
	facades.Route().Post("/api/client/emails/password", clientController.ChangeEmailPassword)
	facades.Route().Get("/api/client/emails/webmail-sso", clientController.WebmailSSO)
	facades.Route().Get("/api/client/backups", clientController.Backups)
	facades.Route().Post("/api/client/backups/generate", clientController.GenerateBackup)
}
