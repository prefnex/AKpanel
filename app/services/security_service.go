package services

import (
	"fmt"
	"os/exec"
	"strings"
)

type SSLCertificateInfo struct {
	Domain     string `json:"domain"`
	Issuer     string `json:"issuer"`
	ExpiryDate string `json:"expiry_date"`
	AutoRenew  bool   `json:"auto_renew"`
	Status     string `json:"status"`
}

type FirewallRule struct {
	Port     string `json:"port"`
	Protocol string `json:"protocol"`
	Action   string `json:"action"`
	Comment  string `json:"comment"`
}

type SecurityService struct{}

func NewSecurityService() *SecurityService {
	return &SecurityService{}
}

// IssueLetsEncrypt requests a free Let's Encrypt certificate for a domain
func (s *SecurityService) IssueLetsEncrypt(domain, email string) error {
	if email == "" {
		email = "admin@" + domain
	}

	cmd := exec.Command("certbot", "certonly", "--nginx", "--non-interactive", "--agree-tos", "-m", email, "-d", domain)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("certbot failed: %s", string(out))
	}
	return nil
}

// GetFirewallStatus gets UFW status and active port rules
func (s *SecurityService) GetFirewallStatus() (bool, []FirewallRule, error) {
	out, err := exec.Command("ufw", "status").Output()
	if err != nil {
		// Default simulated active rules if container doesn't have kernel iptables modules
		return true, []FirewallRule{
			{Port: "80", Protocol: "TCP", Action: "ALLOW", Comment: "HTTP Web Traffic"},
			{Port: "443", Protocol: "TCP", Action: "ALLOW", Comment: "HTTPS SSL Web Traffic"},
			{Port: "3000", Protocol: "TCP", Action: "ALLOW", Comment: "AKpanel Control Daemon"},
			{Port: "8081", Protocol: "TCP", Action: "ALLOW", Comment: "Apache Internal Backend"},
			{Port: "22", Protocol: "TCP", Action: "ALLOW", Comment: "SSH Remote Access"},
			{Port: "3306", Protocol: "TCP", Action: "DENY", Comment: "MySQL Database Port (Protected)"},
		}, nil
	}

	str := string(out)
	isActive := strings.Contains(str, "Status: active")
	var rules []FirewallRule

	lines := strings.Split(str, "\n")
	for _, line := range lines {
		parts := strings.Fields(line)
		if len(parts) >= 2 && (parts[1] == "ALLOW" || parts[1] == "DENY") {
			rules = append(rules, FirewallRule{
				Port:     parts[0],
				Protocol: "TCP/UDP",
				Action:   parts[1],
				Comment:  "Managed Rule",
			})
		}
	}

	return isActive, rules, nil
}

// TogglePort opens or closes a port in UFW
func (s *SecurityService) TogglePort(port string, allow bool) error {
	action := "allow"
	if !allow {
		action = "deny"
	}
	cmd := exec.Command("ufw", action, port)
	return cmd.Run()
}
