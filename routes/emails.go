package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerEmailsRoutes(emailController *controllers.EmailController) {
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
}
