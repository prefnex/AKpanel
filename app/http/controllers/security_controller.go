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

// IssueSSL requests Let's Encrypt / ZeroSSL with automatic local self-signed fallback
func (r *SecurityController) IssueSSL(ctx http.Context) http.Response {
	domain := ctx.Request().Input("domain")
	email := ctx.Request().Input("email")

	if domain == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	result, err := r.securityService.IssueSSL(domain, email)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "SSL configuration error: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": result.Message,
		"data":    result,
	})
}

// Certificates lists all installed SSL certificates
func (r *SecurityController) Certificates(ctx http.Context) http.Response {
	certs := r.securityService.GetAllCertificates()
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   certs,
	})
}

// RenewAll triggers batch renewal via acme.sh
func (r *SecurityController) RenewAll(ctx http.Context) http.Response {
	out, err := r.securityService.RenewAll()
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Renewal failed: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "SSL renewal executed successfully",
		"output":  out,
	})
}

// InstallCustom installs custom user-provided SSL certificate
func (r *SecurityController) InstallCustom(ctx http.Context) http.Response {
	domain := ctx.Request().Input("domain")
	cert := ctx.Request().Input("certificate")
	key := ctx.Request().Input("private_key")
	ca := ctx.Request().Input("ca_bundle")

	if domain == "" || cert == "" || key == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain, certificate, and private key are required",
		})
	}

	if err := r.securityService.InstallCustomCertificate(domain, cert, key, ca); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to install certificate: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Custom SSL certificate installed successfully for " + domain,
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
