package routes

import (
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
	webmailController := controllers.NewWebmailController()
	varnishService := services.NewVarnishService()

	authMiddleware := middleware.NewAuthMiddleware()
	clientAuthMiddleware := middleware.NewClientAuthMiddleware()
	staticAssetMiddleware := middleware.NewStaticAssetMiddleware()

	// Register Global Auth Middleware for full endpoint protection
	facades.Route().GlobalMiddleware(staticAssetMiddleware)
	facades.Route().GlobalMiddleware(authMiddleware)
	facades.Route().GlobalMiddleware(clientAuthMiddleware)

	registerSPARoutes()
	registerAuthRoutes(authController)
	registerPackagesRoutes(packagesController)
	registerIPsRoutes(ipsController)
	registerServerSettingsRoutes(serverSettingsController)
	registerUsersRoutes(usersController)
	registerSSLRoutes(securityController)
	registerDNSRoutes(dnsController)
	registerEmailsRoutes(emailController)
	registerProxyRoutes(phpMyAdminController, webmailController)

	// Static Assets (Vite build output in public/build)
	facades.Route().Static("public", "./public")

	registerSystemRoutes(dashboardController)
	registerWebServersRoutes(webServersController)
	registerPHPRoutes(phpController)
	registerWebsitesRoutes(websitesController)
	registerDatabasesRoutes(databasesController)
	registerFilesRoutes(filesController)
	registerFirewallRoutes(securityController)
	registerTerminalRoutes(terminalController)
	registerVarnishRoutes(varnishService)
	registerClientRoutes(clientController)

	// Fallback must be registered last. Registering it before API routes can make
	// the SPA shell swallow otherwise valid API requests in some route drivers.
	facades.Route().Fallback(serveSPA)
}
