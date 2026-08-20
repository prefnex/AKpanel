package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerPHPRoutes(phpController *controllers.PHPController) {
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
}
