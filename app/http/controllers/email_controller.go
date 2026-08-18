package controllers

import (
	goravelhttp "github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type EmailController struct {
	emailService *services.EmailService
}

func NewEmailController() *EmailController {
	return &EmailController{
		emailService: services.NewEmailService(),
	}
}

type CreateEmailRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	QuotaMB  int    `json:"quota_mb"`
}

type CreateAliasRequest struct {
	Source      string `json:"source"`
	Destination string `json:"destination"`
}

type ChangeMailboxPasswordRequest struct {
	Email       string `json:"email"`
	NewPassword string `json:"new_password"`
}

type ServiceActionRequest struct {
	Service string `json:"service"` // postfix, dovecot, opendkim, spamassassin
	Action  string `json:"action"`  // start, stop, restart, reload
}

// Index lists all email accounts
func (c *EmailController) Index(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Query("domain", "all")
	accounts := c.emailService.ListAccounts(domain)
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   accounts,
	})
}

// Store creates a new email account
func (c *EmailController) Store(ctx goravelhttp.Context) goravelhttp.Response {
	var req CreateEmailRequest
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid request payload",
		})
	}

	if req.Email == "" || req.Password == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Email address and password are required",
		})
	}

	if err := c.emailService.CreateAccount(req.Email, req.Password, req.QuotaMB); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Email mailbox provisioned successfully!",
	})
}

// Destroy deletes an email account
func (c *EmailController) Destroy(ctx goravelhttp.Context) goravelhttp.Response {
	email := ctx.Request().Input("email")
	if email == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Email address is required",
		})
	}

	if err := c.emailService.DeleteAccount(email); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Email mailbox deleted successfully!",
	})
}

// ChangePassword updates mailbox password
func (c *EmailController) ChangePassword(ctx goravelhttp.Context) goravelhttp.Response {
	var req ChangeMailboxPasswordRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Email == "" || req.NewPassword == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Email and new_password are required",
		})
	}

	if err := c.emailService.ChangePassword(req.Email, req.NewPassword); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Mailbox password updated successfully!",
	})
}

// Aliases lists email aliases
func (c *EmailController) Aliases(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Query("domain", "all")
	aliases := c.emailService.ListAliases(domain)
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   aliases,
	})
}

// StoreAlias creates an email alias/forwarder
func (c *EmailController) StoreAlias(ctx goravelhttp.Context) goravelhttp.Response {
	var req CreateAliasRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Source == "" || req.Destination == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Source and destination are required",
		})
	}

	if err := c.emailService.CreateAlias(req.Source, req.Destination); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Email alias forwarder created successfully!",
	})
}

// DestroyAlias deletes an email alias/forwarder
func (c *EmailController) DestroyAlias(ctx goravelhttp.Context) goravelhttp.Response {
	source := ctx.Request().Input("source")
	destination := ctx.Request().Input("destination")

	if source == "" || destination == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Source and destination are required",
		})
	}

	if err := c.emailService.DeleteAlias(source, destination); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Email alias deleted successfully!",
	})
}

// GetConfig returns Mail Server settings
func (c *EmailController) GetConfig(ctx goravelhttp.Context) goravelhttp.Response {
	cfg := c.emailService.GetConfig()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   cfg,
	})
}

// SaveConfig updates Mail Server settings
func (c *EmailController) SaveConfig(ctx goravelhttp.Context) goravelhttp.Response {
	var cfg services.MailServerConfig
	if err := ctx.Request().Bind(&cfg); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid config payload",
		})
	}

	if err := c.emailService.SaveConfig(cfg); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Mail server settings saved and applied to Postfix/Dovecot!",
		"data":    cfg,
	})
}

// ServicesStatus returns live status of Postfix, Dovecot, OpenDKIM
func (c *EmailController) ServicesStatus(ctx goravelhttp.Context) goravelhttp.Response {
	status := c.emailService.GetServiceStatus()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   status,
	})
}

// ControlService controls a mail service daemon (start, stop, restart)
func (c *EmailController) ControlService(ctx goravelhttp.Context) goravelhttp.Response {
	var req ServiceActionRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Service == "" || req.Action == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Service and action are required",
		})
	}

	if err := c.emailService.ControlService(req.Service, req.Action); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Service '" + req.Service + "' " + req.Action + " executed successfully!",
	})
}

// Queue returns Postfix mail queue
func (c *EmailController) Queue(ctx goravelhttp.Context) goravelhttp.Response {
	queue, _ := c.emailService.GetMailQueue()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   queue,
	})
}

// FlushQueue executes postfix flush
func (c *EmailController) FlushQueue(ctx goravelhttp.Context) goravelhttp.Response {
	if err := c.emailService.FlushMailQueue(); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Mail queue flushed successfully!",
	})
}

// DeleteQueue deletes an item or ALL queue items
func (c *EmailController) DeleteQueue(ctx goravelhttp.Context) goravelhttp.Response {
	queueID := ctx.Request().Input("queue_id", "ALL")
	if err := c.emailService.DeleteQueueItem(queueID); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Message removed from mail queue successfully!",
	})
}

// SecurityReport checks SPF, DKIM, DMARC, MX, PTR, and CAA
func (c *EmailController) SecurityReport(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Query("domain", "default.local")
	report := c.emailService.VerifySecurityHealth(domain)
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   report,
	})
}

// WebmailURL returns the direct webmail access URL
func (c *EmailController) WebmailURL(ctx goravelhttp.Context) goravelhttp.Response {
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":      "success",
		"webmail_url": "/webmail",
	})
}
