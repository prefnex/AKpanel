package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerFilesRoutes(filesController *controllers.FilesController) {
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
}
