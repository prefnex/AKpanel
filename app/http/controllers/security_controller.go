package controllers

import (
	"github.com/goravel/framework/contracts/http"
	"goravel/app/services"
	"goravel/app/services/tasks"
)

type SecurityController struct {
	securityService *services.SecurityService
}

func NewSecurityController() *SecurityController {
	return &SecurityController{
		securityService: services.NewSecurityService(),
	}
}

// IssueSSL starts async Let's Encrypt issuance and returns a task_id for live progress.
func (r *SecurityController) IssueSSL(ctx http.Context) http.Response {
	domain := ctx.Request().Input("domain")
	email := ctx.Request().Input("email")

	if domain == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	taskID, err := r.securityService.StartSSLTask("issue", domain, email)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to start SSL issuance: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"task_id": taskID,
		"message": "SSL issuance started — watch the live stages below",
	})
}

func (r *SecurityController) RenewDomain(ctx http.Context) http.Response {
	domain := ctx.Request().Input("domain")
	if domain == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}
	taskID, err := r.securityService.StartSSLTask("renew", domain, "")
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to start SSL renewal: " + err.Error(),
		})
	}
	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"task_id": taskID,
		"message": "SSL renewal started — watch the live stages below",
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

// RenewAll triggers batch renewal via acme.sh as an async task.
func (r *SecurityController) RenewAll(ctx http.Context) http.Response {
	taskID, err := r.securityService.StartSSLTask("renew-all", "", "")
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to start renewal: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"task_id": taskID,
		"message": "Renew-all started — watch the live stages below",
	})
}

func (r *SecurityController) SSLTaskStatus(ctx http.Context) http.Response {
	taskID := ctx.Request().Input("task_id")
	if taskID == "" {
		return ctx.Response().Status(400).Json(http.Json{
			"status":  "error",
			"message": "task_id is required",
		})
	}
	task, err := tasks.GetRegistry().Get(taskID)
	if err != nil {
		return ctx.Response().Status(404).Json(http.Json{
			"status":  "error",
			"message": "Task not found",
		})
	}
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   task,
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
	var req struct {
		Port     string `json:"port"`
		Protocol string `json:"protocol"`
		Action   string `json:"action"`
		FromIP   string `json:"from_ip"`
		Comment  string `json:"comment"`
	}
	_ = ctx.Request().Bind(&req)
	port := req.Port
	if port == "" {
		port = ctx.Request().Input("port")
	}
	proto := req.Protocol
	if proto == "" {
		proto = ctx.Request().Input("protocol", "TCP")
	}
	action := req.Action
	if action == "" {
		action = ctx.Request().Input("action", "allow")
	}
	fromIP := req.FromIP
	if fromIP == "" {
		fromIP = ctx.Request().Input("from_ip", "Anywhere")
	}
	comment := req.Comment
	if comment == "" {
		comment = ctx.Request().Input("comment", "Custom Rule")
	}

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
	var req struct {
		Rule   string `json:"rule"`
		Number string `json:"number"`
	}
	_ = ctx.Request().Bind(&req)
	rule := req.Rule
	if rule == "" {
		rule = req.Number
	}
	if rule == "" {
		rule = ctx.Request().Input("rule")
	}
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
	var req struct {
		Enable *bool `json:"enable"`
	}
	_ = ctx.Request().Bind(&req)
	enable := true
	if req.Enable != nil {
		enable = *req.Enable
	} else {
		enable = ctx.Request().InputBool("enable", true)
	}
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
	var req struct {
		IP   string `json:"ip"`
		Jail string `json:"jail"`
	}
	_ = ctx.Request().Bind(&req)
	ip := req.IP
	if ip == "" {
		ip = ctx.Request().Input("ip")
	}
	jail := req.Jail
	if jail == "" {
		jail = ctx.Request().Input("jail", "sshd")
	}
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
	var req struct {
		IP     string `json:"ip"`
		Reason string `json:"reason"`
	}
	_ = ctx.Request().Bind(&req)
	ip := req.IP
	if ip == "" {
		ip = ctx.Request().Input("ip")
	}
	reason := req.Reason
	if reason == "" {
		reason = ctx.Request().Input("reason", "Manual Ban by Admin")
	}
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
	var req struct {
		Port  string `json:"port"`
		Allow *bool  `json:"allow"`
	}
	_ = ctx.Request().Bind(&req)
	port := req.Port
	if port == "" {
		port = ctx.Request().Input("port")
	}
	allow := true
	if req.Allow != nil {
		allow = *req.Allow
	} else {
		allow = ctx.Request().InputBool("allow", true)
	}

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
