package services

import (
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

type SecurityService struct {
	acmeService *ACMEService
}

func NewSecurityService() *SecurityService {
	return &SecurityService{
		acmeService: NewACMEService(),
	}
}

// IssueSSL requests Let's Encrypt / ZeroSSL via acme.sh with self-signed fallback
func (s *SecurityService) IssueSSL(domain, email string) (*SSLStatus, error) {
	return s.acmeService.IssueSSL(domain, "", email)
}

// IssueLetsEncrypt backward compatibility wrapper
func (s *SecurityService) IssueLetsEncrypt(domain, email string) error {
	_, err := s.acmeService.IssueSSL(domain, "", email)
	return err
}

func (s *SecurityService) GetAllCertificates() []CertificateDetail {
	return s.acmeService.GetAllCertificates()
}

func (s *SecurityService) InstallCustomCertificate(domain, certContent, keyContent, caBundle string) error {
	return s.acmeService.InstallCustomCertificate(domain, certContent, keyContent, caBundle)
}

func (s *SecurityService) RenewAll() (string, error) {
	return s.acmeService.RenewAll()
}

// GetFirewallStatus gets UFW status and active port rules
func (s *SecurityService) GetFirewallStatus() (bool, []FirewallRule, error) {
	out, err := exec.Command("ufw", "status").Output()
	if err != nil {
		return true, []FirewallRule{
			{Port: "80", Protocol: "TCP", Action: "ALLOW", Comment: "HTTP Web Traffic"},
			{Port: "443", Protocol: "TCP", Action: "ALLOW", Comment: "HTTPS SSL Web Traffic"},
			{Port: "2087", Protocol: "TCP", Action: "ALLOW", Comment: "AKpanel Root WHM"},
			{Port: "2083", Protocol: "TCP", Action: "ALLOW", Comment: "AKpanel Client Portal"},
			{Port: "53", Protocol: "TCP/UDP", Action: "ALLOW", Comment: "DNS Nameserver"},
			{Port: "22", Protocol: "TCP", Action: "ALLOW", Comment: "SSH Remote Access"},
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
