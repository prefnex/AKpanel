package services

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"goravel/app/facades"
	"goravel/app/services/tasks"
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
	message := "Hostname SSL is using a self-signed fallback until public DNS points to this server."

	if info, ok := InspectCertificateFile(certPath); ok {
		issuer = info.Issuer
		expiryDate = info.ExpiryDate
		daysLeft = info.DaysLeft
		isSelfSigned = info.SelfSigned
		if info.SelfSigned {
			status = "Self-Signed (Pending DNS / Let's Encrypt Retry)"
			message = "Certificate is self-signed. Issue/Renew after ns1/ns2 at the registrar point to this server."
		} else {
			status = "Active (Trusted)"
			message = fmt.Sprintf("Trusted certificate from %s.", info.Issuer)
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
		Message:      message,
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

// IssueHostnameSSL requests Let's Encrypt via acme.sh with self-signed fallback (synchronous).
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

	s.installHostnameCertToServices(hostname, res.CertPath, res.KeyPath)

	return s.GetHostnameSSL()
}

// StartAsyncIssueHostnameSSL starts background certificate issuance with task progress tracking.
func (s *ServerSettingsService) StartAsyncIssueHostnameSSL(email string) (string, error) {
	settings, _ := s.GetSettings()
	hostname := strings.ToLower(strings.TrimSpace(settings.Hostname))
	if hostname == "" {
		hostname = strings.ToLower(strings.TrimSpace(s.dnsService.GetSystemHostname()))
	}
	if hostname == "" || hostname == "localhost" {
		return "", fmt.Errorf("set a valid server hostname before issuing SSL")
	}

	if email == "" {
		email = settings.AdminEmail
	}
	if email == "" {
		email = "admin@" + hostname
	}

	title := fmt.Sprintf("Issue Hostname SSL for %s", hostname)
	task, err := tasks.GetRegistry().Create("hostname_ssl", hostname, title)
	if err != nil {
		return "", err
	}

	go s.runHostnameSSLTask(task.ID, hostname, email)

	return task.ID, nil
}

func (s *ServerSettingsService) runHostnameSSLTask(taskID, hostname, email string) {
	ctx := context.Background()
	steps := []struct {
		name string
		pct  int
		fn   func() (string, error)
	}{
		{
			name: "ValidateHostname",
			pct:  8,
			fn: func() (string, error) {
				if hostname == "" || hostname == "localhost" {
					return "", fmt.Errorf("invalid hostname: %q", hostname)
				}
				return fmt.Sprintf("Hostname validated: %s", hostname), nil
			},
		},
		{
			name: "SyncAuthoritativeDNS",
			pct:  18,
			fn: func() (string, error) {
				ss, _ := s.GetSettings()
				if err := s.dnsService.ProvisionAuthoritativeHostnameZone(hostname, ss.PrimaryNS, ss.SecondaryNS, ss.SharedIP); err != nil {
					return fmt.Sprintf("BIND sync skipped: %v", err), nil
				}
				return "BIND nameserver zone synced (same action as DNS settings sync)", nil
			},
		},
		{
			name: "PrepareAcmeChallenge",
			pct:  28,
			fn: func() (string, error) {
				_ = os.MkdirAll("/var/www/html/.well-known/acme-challenge", 0777)
				_ = exec.Command("chmod", "-R", "777", "/var/www/html/.well-known").Run()
				if _, _, err := s.acmeService.GenerateSelfSigned(hostname); err != nil {
					return "", err
				}
				nginx := NewNginxService()
				if err := nginx.EnsurePanelHostnameVhost(hostname); err != nil {
					return "", fmt.Errorf("nginx ACME vhost: %w", err)
				}
				if err := s.acmeService.EnsureAcmeInstalled(); err != nil {
					return "", err
				}
				return "ACME webroot + HTTP-01 nginx vhost ready", nil
			},
		},
		{
			name: "IssueCertificate",
			pct:  55,
			fn: func() (string, error) {
				res, err := s.acmeService.IssueSSL(hostname, "/var/www/html", email)
				if err != nil {
					return "", err
				}
				s.installHostnameCertToServices(hostname, res.CertPath, res.KeyPath)
				if res.IsSelfSigned {
					return fmt.Sprintf("Self-signed fallback activated: %s", res.Message), nil
				}
				return fmt.Sprintf("Trusted certificate issued: %s", res.Issuer), nil
			},
		},
		{
			name: "ConfigureNginx",
			pct:  80,
			fn: func() (string, error) {
				nginx := NewNginxService()
				if err := nginx.EnsurePanelHostnameVhost(hostname); err != nil {
					return "", fmt.Errorf("nginx panel vhost: %w", err)
				}
				nginx.EnsureDefaultNginxConfig()
				return "Nginx panel vhost updated for port 443", nil
			},
		},
		{
			name: "VerifySSL",
			pct:  95,
			fn: func() (string, error) {
				info, err := s.GetHostnameSSL()
				if err != nil {
					return "", err
				}
				if info.IsSelfSigned {
					return "Verification complete (self-signed — retry when DNS is ready)", nil
				}
				return fmt.Sprintf("Verification complete — issuer: %s", info.Issuer), nil
			},
		},
	}

	for _, step := range steps {
		_ = tasks.GetRegistry().UpdateProgress(taskID, step.name, step.pct, fmt.Sprintf("Running step: %s", step.name))
		logLine, err := step.fn()
		if err != nil {
			_ = tasks.GetRegistry().Fail(taskID, fmt.Sprintf("step '%s' failed: %v", step.name, err), fmt.Sprintf("Failed: step '%s': %v", step.name, err))
			if facades.Log() != nil {
				facades.Log().Error(fmt.Sprintf("[hostname-ssl] %v", err))
			}
			return
		}
		if logLine != "" {
			_ = tasks.GetRegistry().UpdateProgress(taskID, step.name, step.pct, logLine)
		}
	}

	_ = tasks.GetRegistry().Complete(taskID, fmt.Sprintf("Hostname SSL configured for %s", hostname))
	_ = ctx
}

func (s *ServerSettingsService) installHostnameCertToServices(hostname, certPath, keyPath string) {
	_ = os.MkdirAll("/etc/akpanel/ssl/server", 0755)
	_ = exec.Command("cp", "-f", certPath, "/etc/akpanel/ssl/server/fullchain.pem").Run()
	_ = exec.Command("cp", "-f", keyPath, "/etc/akpanel/ssl/server/privkey.pem").Run()

	if hostname != "" && hostname != "localhost" {
		hostDir := fmt.Sprintf("/etc/akpanel/ssl/%s", hostname)
		_ = os.MkdirAll(hostDir, 0755)
		_ = exec.Command("cp", "-f", certPath, filepath.Join(hostDir, "fullchain.pem")).Run()
		_ = exec.Command("cp", "-f", keyPath, filepath.Join(hostDir, "privkey.pem")).Run()
	}

	nginx := NewNginxService()
	_ = nginx.EnsurePanelHostnameVhost(hostname)
	nginx.EnsureDefaultNginxConfig()

	// Update Dovecot & Postfix
	_ = exec.Command("postconf", "-e", fmt.Sprintf("smtpd_tls_cert_file = %s", certPath)).Run()
	_ = exec.Command("postconf", "-e", fmt.Sprintf("smtpd_tls_key_file = %s", keyPath)).Run()
	_ = exec.Command("service", "postfix", "reload").Run()
	_ = exec.Command("service", "dovecot", "reload").Run()
	_ = exec.Command("service", "nginx", "reload").Run()
}
