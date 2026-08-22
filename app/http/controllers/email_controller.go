package controllers

import (
	"errors"
	"strconv"

	goravelhttp "github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type EmailController struct {
	emailService        *services.EmailService
	mailDeliveryService *services.MailDeliveryService
}

func NewEmailController() *EmailController {
	return &EmailController{
		emailService:        services.NewEmailService(),
		mailDeliveryService: services.NewMailDeliveryService(),
	}
}

type CreateEmailRequest struct {
	Email     string `json:"email"`
	LocalPart string `json:"username"`
	Domain    string `json:"domain"`
	Password  string `json:"password"`
	QuotaMB   int    `json:"quota_mb"`
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

	if req.Email == "" && req.LocalPart != "" && req.Domain != "" {
		req.Email = req.LocalPart + "@" + req.Domain
	}
	if req.Email == "" || req.Password == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Email address and password are required",
		})
	}

	if err := c.emailService.CreateAccount(req.Email, req.Password, req.QuotaMB); err != nil {
		if errors.Is(err, services.ErrMailboxExists) {
			return ctx.Response().Status(409).Json(goravelhttp.Json{
				"status":  "error",
				"message": err.Error(),
			})
		}
		return ctx.Response().Status(500).Json(goravelhttp.Json{
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

// Queue returns Postfix mail queue with delivery stats and recent log events.
func (c *EmailController) Queue(ctx goravelhttp.Context) goravelhttp.Response {
	overview := c.mailDeliveryService.GetOverview(50)
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   overview.Queue,
		"stats":  overview.Stats,
		"recent": overview.Recent,
	})
}

// MailDiagnostics returns filtered postconf, LMTP socket state, and mail log tail.
func (c *EmailController) MailDiagnostics(ctx goravelhttp.Context) goravelhttp.Response {
	diag := c.mailDeliveryService.GetDiagnostics()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   diag,
	})
}

// Deliveries lists parsed delivery history with pagination.
func (c *EmailController) Deliveries(ctx goravelhttp.Context) goravelhttp.Response {
	page, _ := strconv.Atoi(ctx.Request().Query("page", "1"))
	perPage, _ := strconv.Atoi(ctx.Request().Query("per_page", "25"))
	status := ctx.Request().Query("status", "")
	recipient := ctx.Request().Query("recipient", "")
	rows, total, err := c.mailDeliveryService.ListDeliveries(page, perPage, status, recipient)
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":   "success",
		"data":     rows,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// DeliveryDetail returns one stored delivery record.
func (c *EmailController) DeliveryDetail(ctx goravelhttp.Context) goravelhttp.Response {
	id, _ := strconv.ParseUint(ctx.Request().Input("id", "0"), 10, 64)
	row, err := c.mailDeliveryService.GetDelivery(uint(id))
	if err != nil {
		return ctx.Response().Status(404).Json(goravelhttp.Json{"status": "error", "message": "delivery not found"})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{"status": "success", "data": row})
}

// QueueMessageContent returns postcat headers/body for a queued message.
func (c *EmailController) QueueMessageContent(ctx goravelhttp.Context) goravelhttp.Response {
	queueID := ctx.Request().Input("queue_id", "")
	headers, body, err := c.mailDeliveryService.GetQueueMessageContent(queueID)
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"headers": headers,
		"body":    body,
	})
}

// RetryQueue retries a single queued message.
func (c *EmailController) RetryQueue(ctx goravelhttp.Context) goravelhttp.Response {
	queueID := ctx.Request().Input("queue_id", "")
	if err := c.mailDeliveryService.RetryQueueItem(queueID); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Queue item scheduled for immediate delivery",
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
		"webmail_url": "/roundcube/",
	})
}

// Autoresponders lists Sieve vacation rules
func (c *EmailController) Autoresponders(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Query("domain", "all")
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   services.NewMailSieveService().List(domain),
	})
}

// StoreAutoresponder creates or updates the vacation rule for a mailbox
func (c *EmailController) StoreAutoresponder(ctx goravelhttp.Context) goravelhttp.Response {
	var req services.Autoresponder
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid autoresponder payload",
		})
	}
	if err := services.NewMailSieveService().Save(req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Autoresponder saved and activated for " + req.Email,
	})
}

// DestroyAutoresponder removes the vacation rule for a mailbox
func (c *EmailController) DestroyAutoresponder(ctx goravelhttp.Context) goravelhttp.Response {
	email := ctx.Request().Input("email")
	if email == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Email address is required",
		})
	}
	if err := services.NewMailSieveService().Delete(email); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Autoresponder removed successfully!",
	})
}

// AntiSpam returns the live SpamAssassin policy
func (c *EmailController) AntiSpam(ctx goravelhttp.Context) goravelhttp.Response {
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   services.NewMailPolicyService().GetAntiSpam(),
	})
}

// SaveAntiSpam applies the SpamAssassin policy and milter wiring
func (c *EmailController) SaveAntiSpam(ctx goravelhttp.Context) goravelhttp.Response {
	var req services.AntiSpamSettings
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid anti-spam payload",
		})
	}
	if err := services.NewMailPolicyService().SaveAntiSpam(req); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Anti-spam policy applied to Postfix and SpamAssassin!",
		"data":    services.NewMailPolicyService().GetAntiSpam(),
	})
}

// UpdateSpamRules runs sa-update and restarts SpamAssassin
func (c *EmailController) UpdateSpamRules(ctx goravelhttp.Context) goravelhttp.Response {
	if err := services.NewMailPolicyService().UpdateSpamRules(); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "SpamAssassin rule set updated!",
	})
}

// Routing lists per-domain mail transport rules
func (c *EmailController) Routing(ctx goravelhttp.Context) goravelhttp.Response {
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   services.NewMailPolicyService().ListRoutes(),
	})
}

// SaveRouting writes a transport rule for one domain
func (c *EmailController) SaveRouting(ctx goravelhttp.Context) goravelhttp.Response {
	var req services.MailRoute
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid routing payload",
		})
	}
	if err := services.NewMailPolicyService().SaveRoute(req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Mail routing for " + req.Domain + " applied to Postfix transport map!",
	})
}

// DestroyRouting drops a transport rule
func (c *EmailController) DestroyRouting(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Input("domain")
	if domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}
	if err := services.NewMailPolicyService().DeleteRoute(domain); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Mail routing rule removed successfully!",
	})
}

// WebmailSSO issues a one-time auto-login URL for a mailbox.
func (c *EmailController) WebmailSSO(ctx goravelhttp.Context) goravelhttp.Response {
	email := ctx.Request().Query("email", "")
	if email == "" {
		email = ctx.Request().Input("email")
	}
	token, err := c.emailService.IssueWebmailSSOToken(email)
	if err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"url":    "/webmail/sso?token=" + token,
	})
}
