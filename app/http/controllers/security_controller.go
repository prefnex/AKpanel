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

// Firewall returns UFW firewall rules and fail2ban data
func (r *SecurityController) Firewall(ctx http.Context) http.Response {
	data := r.securityService.GetFullFirewallInfo()
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   data,
	})
}

// AddRule creates a new firewall rule
func (r *SecurityController) AddRule(ctx http.Context) http.Response {
	port := ctx.Request().Input("port")
	proto := ctx.Request().Input("protocol", "TCP/UDP")
	action := ctx.Request().Input("action", "allow")
	fromIP := ctx.Request().Input("from_ip", "Anywhere")
	comment := ctx.Request().Input("comment", "Custom Rule")

	if port == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Port or port range is required",
		})
	}

	if err := r.securityService.AddFirewallRule(port, proto, action, fromIP, comment); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Firewall rule created successfully for port " + port,
	})
}

// DeleteRule removes a firewall rule
func (r *SecurityController) DeleteRule(ctx http.Context) http.Response {
	rule := ctx.Request().Input("rule")
	if rule == "" {
		rule = ctx.Request().Input("number")
	}
	if rule == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Rule number or port is required",
		})
	}

	if err := r.securityService.DeleteFirewallRule(rule); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Firewall rule deleted successfully",
	})
}

// ToggleFirewall enables or disables the whole firewall
func (r *SecurityController) ToggleFirewall(ctx http.Context) http.Response {
	enable := ctx.Request().InputBool("enable", true)
	if err := r.securityService.SetFirewallEnabled(enable); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	state := "enabled"
	if !enable {
		state = "disabled"
	}
	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "UFW Firewall " + state + " successfully",
	})
}

// UnbanIP unbans an IP from Fail2Ban
func (r *SecurityController) UnbanIP(ctx http.Context) http.Response {
	ip := ctx.Request().Input("ip")
	jail := ctx.Request().Input("jail", "sshd")
	if ip == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "IP address is required",
		})
	}

	if err := r.securityService.UnbanIP(ip, jail); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "IP " + ip + " unbanned successfully from " + jail,
	})
}

// BanIP manually bans an IP in the firewall
func (r *SecurityController) BanIP(ctx http.Context) http.Response {
	ip := ctx.Request().Input("ip")
	reason := ctx.Request().Input("reason", "Manual Ban by Admin")
	if ip == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "IP address is required",
		})
	}

	if err := r.securityService.BanIP(ip, reason); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "IP " + ip + " added to blacklist successfully",
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
