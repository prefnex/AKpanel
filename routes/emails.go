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
	facades.Route().Get("/api/emails/webmail-sso", emailController.WebmailSSO)
	facades.Route().Get("/api/emails/webmail-url", emailController.WebmailURL)
	facades.Route().Get("/api/emails/security-report", emailController.SecurityReport)

	// Sieve autoresponders
	facades.Route().Get("/api/emails/autoresponders", emailController.Autoresponders)
	facades.Route().Post("/api/emails/autoresponders", emailController.StoreAutoresponder)
	facades.Route().Post("/api/emails/autoresponders/delete", emailController.DestroyAutoresponder)

	// SpamAssassin policy
	facades.Route().Get("/api/emails/antispam", emailController.AntiSpam)
	facades.Route().Post("/api/emails/antispam", emailController.SaveAntiSpam)
	facades.Route().Post("/api/emails/antispam/update-rules", emailController.UpdateSpamRules)

	// Postfix transport routing
	facades.Route().Get("/api/emails/routing", emailController.Routing)
	facades.Route().Post("/api/emails/routing", emailController.SaveRouting)
	facades.Route().Post("/api/emails/routing/delete", emailController.DestroyRouting)
}
