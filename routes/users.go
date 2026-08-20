package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerUsersRoutes(usersController *controllers.UsersController) {
	// Multi-Tenant User Accounts Management API
	facades.Route().Get("/api/users", usersController.Index)
	facades.Route().Post("/api/users", usersController.Store)
	facades.Route().Post("/api/users/provision", usersController.Provision)
	facades.Route().Get("/api/users/provision/status", usersController.ProvisionStatus)
	facades.Route().Get("/api/tasks/active", usersController.ActiveTasks)
	facades.Route().Post("/api/users/update", usersController.Update)
	facades.Route().Post("/api/users/suspend", usersController.Suspend)
	facades.Route().Post("/api/users/unsuspend", usersController.Unsuspend)
	facades.Route().Post("/api/users/reset-password", usersController.ResetPassword)
	facades.Route().Post("/api/users/fix-permissions", usersController.FixPermissions)
	facades.Route().Post("/api/users/change-package", usersController.ChangePackage)
	facades.Route().Post("/api/users/delete", usersController.Destroy)
}
