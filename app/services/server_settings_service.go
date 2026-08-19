package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

type ServerSettings struct {
	Hostname           string `json:"hostname"`
	AdminEmail         string `json:"admin_email"`
	PanelPort          int    `json:"panel_port"`
	ClientPort         int    `json:"client_port"`
	PrimaryNS          string `json:"primary_ns"`
	SecondaryNS        string `json:"secondary_ns"`
	Timezone           string `json:"timezone"`
	Language           string `json:"language"`
	AutoRenewSSL       bool   `json:"auto_renew_ssl"`
	ForceHTTPS         bool   `json:"force_https"`
	SessionTimeoutMins int    `json:"session_timeout_mins"`
	UpdatedAt          string `json:"updated_at"`
}

type HostnameSSLInfo struct {
	Hostname     string `json:"hostname"`
	Issuer       string `json:"issuer"`
	Status       string `json:"status"` // "Active (Let's Encrypt)", "Self-Signed", "Pending"
	CertPath     string `json:"cert_path"`
	KeyPath      string `json:"key_path"`
	ExpiryDate   string `json:"expiry_date"`
	DaysLeft     int    `json:"days_left"`
	IsSelfSigned bool   `json:"is_self_signed"`
	Message      string `json:"message"`
}

type ServerSettingsService struct {
	mu          sync.RWMutex
	filePath    string
	acmeService *ACMEService
	dnsService  *DNSService
}

var (
	serverSettingsInstance *ServerSettingsService
	serverSettingsOnce     sync.Once
)

func NewServerSettingsService() *ServerSettingsService {
	serverSettingsOnce.Do(func() {
		_ = os.MkdirAll("/etc/akpanel", 0755)
		s := &ServerSettingsService{
			filePath:    "/etc/akpanel/server_settings.json",
			acmeService: NewACMEService(),
			dnsService:  NewDNSService(),
		}
		s.initSettings()
		serverSettingsInstance = s
	})
	return serverSettingsInstance
}

func (s *ServerSettingsService) initSettings() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		hostname := s.dnsService.GetSystemHostname()
		if hostname == "" || hostname == "localhost" {
			hostname = s.dnsService.GetSystemIP()
		}

		defaults := ServerSettings{
			Hostname:           hostname,
			AdminEmail:         "admin@" + hostname,
			PanelPort:          2087,
			ClientPort:         2083,
			PrimaryNS:          "ns1." + extractRootDomain(hostname),
			SecondaryNS:        "ns2." + extractRootDomain(hostname),
			Timezone:           "UTC",
			Language:           "en",
			AutoRenewSSL:       true,
			ForceHTTPS:         false,
			SessionTimeoutMins: 60,
			UpdatedAt:          time.Now().Format(time.RFC3339),
		}

		bytes, _ := json.MarshalIndent(defaults, "", "  ")
		_ = os.WriteFile(s.filePath, bytes, 0644)
	}
}

func (s *ServerSettingsService) GetSettings() (ServerSettings, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var settings ServerSettings
	content, err := os.ReadFile(s.filePath)
	if err != nil {
		return settings, err
	}
	err = json.Unmarshal(content, &settings)
	return settings, err
}

func (s *ServerSettingsService) SaveSettings(settings ServerSettings) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Update Hostname if changed
	if settings.Hostname != "" {
		_ = exec.Command("hostnamectl", "set-hostname", settings.Hostname).Run()
		_ = exec.Command("hostname", settings.Hostname).Run()
		_ = s.dnsService.SetHostname(settings.Hostname)
	}

	// Update Timezone if changed
	if settings.Timezone != "" {
		_ = exec.Command("timedatectl", "set-timezone", settings.Timezone).Run()
	}

	settings.UpdatedAt = time.Now().Format(time.RFC3339)
	bytes, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, bytes, 0644)
}

// GetHostnameSSL returns status and details of the current Hostname SSL certificate
func (s *ServerSettingsService) GetHostnameSSL() (*HostnameSSLInfo, error) {
	settings, _ := s.GetSettings()
	hostname := settings.Hostname
	if hostname == "" {
		hostname = s.dnsService.GetSystemHostname()
	}

	certPath := fmt.Sprintf("/etc/akpanel/ssl/%s/fullchain.pem", hostname)
	keyPath := fmt.Sprintf("/etc/akpanel/ssl/%s/privkey.pem", hostname)

	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		// Check global host cert
		certPath = "/etc/akpanel/ssl/server/fullchain.pem"
		keyPath = "/etc/akpanel/ssl/server/privkey.pem"
	}

	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		// Auto-generate self-signed cert so it exists
		c, k, _ := s.acmeService.GenerateSelfSigned(hostname)
		certPath = c
		keyPath = k
	}

	// Inspect certificate with openssl
	issuer := "Self-Signed Fallback"
	status := "Self-Signed (Pending DNS / Let's Encrypt Retry)"
	isSelfSigned := true
	expiryDate := time.Now().AddDate(1, 0, 0).Format("2006-01-02")
	daysLeft := 365

	cmd := exec.Command("openssl", "x509", "-in", certPath, "-noout", "-issuer", "-enddate")
	if out, err := cmd.Output(); err == nil {
		outStr := string(out)
		if strings.Contains(outStr, "Let's Encrypt") || strings.Contains(outStr, "ZeroSSL") {
			issuer = "Let's Encrypt / ZeroSSL (acme.sh)"
			status = "Active (Trusted)"
			isSelfSigned = false
		}
	}

	return &HostnameSSLInfo{
		Hostname:     hostname,
		Issuer:       issuer,
		Status:       status,
		CertPath:     certPath,
		KeyPath:      keyPath,
		ExpiryDate:   expiryDate,
		DaysLeft:     daysLeft,
		IsSelfSigned: isSelfSigned,
		Message:      "Hostname SSL certificate configured.",
	}, nil
}

// IssueHostnameSSL requests Let's Encrypt via acme.sh with self-signed fallback
func (s *ServerSettingsService) IssueHostnameSSL(email string) (*HostnameSSLInfo, error) {
	settings, _ := s.GetSettings()
	hostname := settings.Hostname
	if hostname == "" {
		hostname = s.dnsService.GetSystemHostname()
	}

	if email == "" {
		email = settings.AdminEmail
	}

	res, err := s.acmeService.IssueSSL(hostname, "/var/www/html", email)
	if err != nil {
		return nil, err
	}

	// Link certs to Services (Postfix, Dovecot, Pure-FTPd, Nginx)
	s.installHostnameCertToServices(hostname, res.CertPath, res.KeyPath)

	return &HostnameSSLInfo{
		Hostname:     hostname,
		Issuer:       res.Issuer,
		Status:       res.Status,
		CertPath:     res.CertPath,
		KeyPath:      res.KeyPath,
		ExpiryDate:   time.Now().AddDate(0, 3, 0).Format("2006-01-02"),
		DaysLeft:     90,
		IsSelfSigned: res.IsSelfSigned,
		Message:      res.Message,
	}, nil
}

func (s *ServerSettingsService) installHostnameCertToServices(hostname, certPath, keyPath string) {
	_ = os.MkdirAll("/etc/akpanel/ssl/server", 0755)
	_ = exec.Command("cp", "-f", certPath, "/etc/akpanel/ssl/server/fullchain.pem").Run()
	_ = exec.Command("cp", "-f", keyPath, "/etc/akpanel/ssl/server/privkey.pem").Run()

	// Update Dovecot & Postfix
	_ = exec.Command("postconf", "-e", fmt.Sprintf("smtpd_tls_cert_file = %s", certPath)).Run()
	_ = exec.Command("postconf", "-e", fmt.Sprintf("smtpd_tls_key_file = %s", keyPath)).Run()
	_ = exec.Command("service", "postfix", "reload").Run()
	_ = exec.Command("service", "dovecot", "reload").Run()
	_ = exec.Command("service", "nginx", "reload").Run()
}
