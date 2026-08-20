package services

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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
	SharedIP           string `json:"shared_ip"`
	IPStackMode        string `json:"ip_stack_mode"`
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
			SharedIP:           s.dnsService.GetSystemIP(),
			IPStackMode:        "dual",
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

	// The server settings page owns the defaults displayed to administrators, but
	// BIND owns its extra settings (TTL, DNSSEC, Cloudflare, etc.). Merge into the
	// existing DNS document instead of replacing it with a partial payload.
	dnsSettings := s.dnsService.GetSettings()
	if settings.Hostname != "" {
		dnsSettings.ServerHostname = settings.Hostname
	}
	if settings.PrimaryNS != "" {
		dnsSettings.PrimaryNS = settings.PrimaryNS
	}
	if settings.SecondaryNS != "" {
		dnsSettings.SecondaryNS = settings.SecondaryNS
	}
	if settings.SharedIP != "" {
		dnsSettings.PrimaryIP = settings.SharedIP
		dnsSettings.SecondaryIP = settings.SharedIP
	}
	if err := s.dnsService.SaveSettings(dnsSettings); err != nil {
		return err
	}

	// Apply the hostname once, through the DNS service, which also updates
	// /etc/hosts and the DNS hostname field consistently.
	if settings.Hostname != "" {
		if err := s.dnsService.SetHostname(settings.Hostname); err != nil {
			return err
		}
	}

	// Update Timezone if changed
	if settings.Timezone != "" {
		_ = exec.Command("timedatectl", "set-timezone", settings.Timezone).Run()
	}
	if settings.SharedIP == "" {
		settings.SharedIP = dnsSettings.PrimaryIP
	}
	if settings.IPStackMode == "" {
		settings.IPStackMode = "dual"
	}

	settings.UpdatedAt = time.Now().Format(time.RFC3339)
	bytes, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, bytes, 0644)
}

// SyncDNSSettings mirrors values edited from the dedicated DNS screen without
// writing DNS again. This keeps both screens coherent while preserving DNS-only
// settings such as DNSSEC and Cloudflare credentials.
func (s *ServerSettingsService) SyncDNSSettings(dnsSettings DNSSettings) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	settings, err := s.getSettingsUnsafe()
	if err != nil {
		return err
	}
	if dnsSettings.ServerHostname != "" {
		settings.Hostname = dnsSettings.ServerHostname
	}
	settings.PrimaryNS = dnsSettings.PrimaryNS
	settings.SecondaryNS = dnsSettings.SecondaryNS
	settings.SharedIP = dnsSettings.PrimaryIP
	settings.UpdatedAt = time.Now().Format(time.RFC3339)

	bytes, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, bytes, 0644)
}

func (s *ServerSettingsService) getSettingsUnsafe() (ServerSettings, error) {
	var settings ServerSettings
	content, err := os.ReadFile(s.filePath)
	if err != nil {
		return settings, err
	}
	err = json.Unmarshal(content, &settings)
	return settings, err
}

// GetHostnameSSL returns status and details of the current Hostname SSL certificate
func (s *ServerSettingsService) GetHostnameSSL() (*HostnameSSLInfo, error) {
	settings, _ := s.GetSettings()
	hostname := settings.Hostname
	if hostname == "" {
		hostname = s.dnsService.GetSystemHostname()
	}

	certPath := "/etc/akpanel/ssl/server/fullchain.pem"
	keyPath := "/etc/akpanel/ssl/server/privkey.pem"

	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		// Check hostname-specific dir
		hCert := fmt.Sprintf("/etc/akpanel/ssl/%s/fullchain.pem", hostname)
		hKey := fmt.Sprintf("/etc/akpanel/ssl/%s/privkey.pem", hostname)
		if _, errH := os.Stat(hCert); errH == nil {
			certPath = hCert
			keyPath = hKey
		}
	}

	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		// Auto-generate self-signed cert so it exists
		c, k, _ := s.acmeService.GenerateSelfSigned(hostname)
		certPath = c
		keyPath = k
	}

	issuer := "Self-Signed Fallback"
	status := "Self-Signed (Pending DNS / Let's Encrypt Retry)"
	isSelfSigned := true
	expiryDate := time.Now().AddDate(1, 0, 0).Format("2006-01-02")
	daysLeft := 365

	// Parse PEM certificate directly in Go
	if certData, err := os.ReadFile(certPath); err == nil {
		block, _ := pem.Decode(certData)
		if block != nil {
			if cert, errParse := x509.ParseCertificate(block.Bytes); errParse == nil {
				expiryDate = cert.NotAfter.Format("2006-01-02")
				daysLeft = int(time.Until(cert.NotAfter).Hours() / 24)
				if daysLeft < 0 {
					daysLeft = 0
				}
				org := cert.Issuer.Organization
				commonName := cert.Issuer.CommonName
				if len(org) > 0 && (strings.Contains(org[0], "Let's Encrypt") || strings.Contains(org[0], "ZeroSSL") || strings.Contains(org[0], "Google Trust Services") || strings.Contains(org[0], "DigiCert") || strings.Contains(org[0], "Sectigo")) {
					issuer = org[0]
					status = "Active (Trusted)"
					isSelfSigned = false
				} else if commonName != "" {
					issuer = commonName
					if !strings.Contains(strings.ToLower(commonName), "self") && !strings.Contains(strings.ToLower(commonName), "akpanel") && !strings.Contains(strings.ToLower(commonName), "localhost") {
						status = "Active (Trusted)"
						isSelfSigned = false
					}
				}
			}
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

// SaveCustomHostnameSSL validates and installs a custom PEM certificate and private key
func (s *ServerSettingsService) SaveCustomHostnameSSL(certPEM, keyPEM string) (*HostnameSSLInfo, error) {
	certPEM = strings.TrimSpace(certPEM)
	keyPEM = strings.TrimSpace(keyPEM)

	if certPEM == "" || keyPEM == "" {
		return nil, fmt.Errorf("certificate and private key contents cannot be empty")
	}

	// Validate TLS key pair
	_, err := tls.X509KeyPair([]byte(certPEM), []byte(keyPEM))
	if err != nil {
		return nil, fmt.Errorf("invalid certificate or private key pair: %w", err)
	}

	settings, _ := s.GetSettings()
	hostname := settings.Hostname
	if hostname == "" {
		hostname = s.dnsService.GetSystemHostname()
	}

	serverDir := "/etc/akpanel/ssl/server"
	_ = os.MkdirAll(serverDir, 0755)

	certPath := filepath.Join(serverDir, "fullchain.pem")
	keyPath := filepath.Join(serverDir, "privkey.pem")

	if err := os.WriteFile(certPath, []byte(certPEM), 0644); err != nil {
		return nil, fmt.Errorf("failed to save certificate: %w", err)
	}
	if err := os.WriteFile(keyPath, []byte(keyPEM), 0600); err != nil {
		return nil, fmt.Errorf("failed to save private key: %w", err)
	}

	// Also mirror to /etc/akpanel/ssl/{hostname}/
	if hostname != "" && hostname != "localhost" {
		hostDir := fmt.Sprintf("/etc/akpanel/ssl/%s", hostname)
		_ = os.MkdirAll(hostDir, 0755)
		_ = os.WriteFile(filepath.Join(hostDir, "fullchain.pem"), []byte(certPEM), 0644)
		_ = os.WriteFile(filepath.Join(hostDir, "privkey.pem"), []byte(keyPEM), 0600)
	}

	s.installHostnameCertToServices(hostname, certPath, keyPath)

	return s.GetHostnameSSL()
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

	return s.GetHostnameSSL()
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
