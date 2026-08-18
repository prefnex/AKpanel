package controllers

import (
	"github.com/goravel/framework/contracts/http"
	"goravel/app/services"
)

type SecurityController struct {
	securityService *services.SecurityService
}

func NewSecurityController() *SecurityController {
	return &SecurityController{
		securityService: services.NewSecurityService(),
	}
}

// IssueSSL requests a Let's Encrypt certificate
func (r *SecurityController) IssueSSL(ctx http.Context) http.Response {
	domain := ctx.Request().Input("domain")
	email := ctx.Request().Input("email")

	if domain == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "domain is required",
		})
	}

	if err := r.securityService.IssueLetsEncrypt(domain, email); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Let's Encrypt SSL certificate issued successfully for " + domain,
	})
}

// Firewall returns UFW firewall rules
func (r *SecurityController) Firewall(ctx http.Context) http.Response {
	active, rules, err := r.securityService.GetFirewallStatus()
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":    "success",
		"is_active": active,
		"data":      rules,
	})
}

// TogglePort opens or closes a port in UFW
func (r *SecurityController) TogglePort(ctx http.Context) http.Response {
	port := ctx.Request().Input("port")
	allow := ctx.Request().InputBool("allow", true)

	if port == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "port is required",
		})
	}

	if err := r.securityService.TogglePort(port, allow); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Port " + port + " updated successfully",
	})
}
