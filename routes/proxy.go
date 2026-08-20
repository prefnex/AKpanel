package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerProxyRoutes(phpMyAdminController *controllers.PhpMyAdminController, webmailController *controllers.WebmailController) {
	// phpMyAdmin Web GUI Reverse Proxy (Forwarding transparently to port 8085)
	facades.Route().Any("/phpmyadmin", phpMyAdminController.Proxy)
	facades.Route().Any("/phpmyadmin/*path", phpMyAdminController.Proxy)
	facades.Route().Any("/index.php", phpMyAdminController.Proxy)
	facades.Route().Any("/url.php", phpMyAdminController.Proxy)
	facades.Route().Any("/themes/*path", phpMyAdminController.Proxy)
	facades.Route().Any("/js/*path", phpMyAdminController.Proxy)

	// Roundcube Webmail Web GUI Reverse Proxy (Forwarding transparently to port 8086)
	facades.Route().Any("/roundcube/*path", webmailController.Proxy)
	facades.Route().Any("/webmail/*path", webmailController.Proxy)
}
