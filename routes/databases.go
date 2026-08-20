package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerDatabasesRoutes(databasesController *controllers.DatabasesController) {
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
}
