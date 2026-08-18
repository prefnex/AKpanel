package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

type SSLStatus struct {
	Domain       string `json:"domain"`
	Issuer       string `json:"issuer"`
	Status       string `json:"status"`
	CertPath     string `json:"cert_path"`
	KeyPath      string `json:"key_path"`
	IsSelfSigned bool   `json:"is_self_signed"`
	Message      string `json:"message"`
}

type ACMEService struct {
	mu         sync.Mutex
	acmeBin    string
	sslBaseDir string
}

func NewACMEService() *ACMEService {
	s := &ACMEService{
		sslBaseDir: "/etc/akpanel/ssl",
	}
	s.acmeBin = s.detectAcmeBin()
	_ = os.MkdirAll(s.sslBaseDir, 0755)
	return s
}

func (a *ACMEService) detectAcmeBin() string {
	paths := []string{
		"/root/.acme.sh/acme.sh",
		filepath.Join(os.Getenv("HOME"), ".acme.sh", "acme.sh"),
		"/usr/local/bin/acme.sh",
		"/usr/bin/acme.sh",
	}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if p, err := exec.LookPath("acme.sh"); err == nil {
		return p
	}
	return "/root/.acme.sh/acme.sh"
}

func (a *ACMEService) EnsureAcmeInstalled() error {
	if _, err := os.Stat(a.acmeBin); err == nil {
		return nil
	}
	cmd := exec.Command("bash", "-c", "curl -fsSL https://get.acme.sh | sh -s email=admin@akpanel.site")
	_ = cmd.Run()
	a.acmeBin = a.detectAcmeBin()
	return nil
}

// GenerateSelfSigned creates a temporary valid local SSL cert so HTTPS always works
func (a *ACMEService) GenerateSelfSigned(domain string) (string, string, error) {
	domain = strings.ToLower(strings.TrimSpace(domain))
	domainDir := filepath.Join(a.sslBaseDir, domain)
	_ = os.MkdirAll(domainDir, 0755)
	certPath := filepath.Join(domainDir, "fullchain.pem")
	keyPath := filepath.Join(domainDir, "privkey.pem")

	if _, err := os.Stat(certPath); err == nil {
		if _, err := os.Stat(keyPath); err == nil {
			return certPath, keyPath, nil
		}
	}

	subj := fmt.Sprintf("/C=US/ST=Cloud/L=Server/O=AKpanel/CN=%s", domain)
	cmd := exec.Command("openssl", "req", "-x509", "-nodes", "-days", "365",
		"-newkey", "rsa:2048",
		"-keyout", keyPath,
		"-out", certPath,
		"-subj", subj,
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", "", fmt.Errorf("openssl generation error: %s", string(out))
	}
	return certPath, keyPath, nil
}

// IssueSSL requests Let's Encrypt via acme.sh, and falls back to self-signed on failure
func (a *ACMEService) IssueSSL(domain, webroot, email string) (*SSLStatus, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	domain = strings.ToLower(strings.TrimSpace(domain))
	if domain == "" {
		return nil, fmt.Errorf("domain cannot be empty")
	}
	if email == "" {
		email = "admin@" + domain
	}
	if webroot == "" {
		webroot = fmt.Sprintf("/var/www/sites/%s/public", domain)
	}

	domainDir := filepath.Join(a.sslBaseDir, domain)
	_ = os.MkdirAll(domainDir, 0755)
	certPath := filepath.Join(domainDir, "fullchain.pem")
	keyPath := filepath.Join(domainDir, "privkey.pem")

	_ = a.EnsureAcmeInstalled()

	// Try acme.sh issuance
	var issueSuccess bool
	if _, err := os.Stat(a.acmeBin); err == nil {
		cmdIssue := exec.Command(a.acmeBin,
			"--issue",
			"-d", domain,
			"-w", webroot,
			"--server", "letsencrypt",
			"--force",
		)
		if err := cmdIssue.Run(); err == nil {
			cmdInstall := exec.Command(a.acmeBin,
				"--install-cert",
				"-d", domain,
				"--key-file", keyPath,
				"--fullchain-file", certPath,
				"--reloadcmd", "service nginx reload 2>/dev/null || true; service apache2 reload 2>/dev/null || true",
			)
			if err := cmdInstall.Run(); err == nil {
				issueSuccess = true
			}
		}
	}

	if issueSuccess {
		return &SSLStatus{
			Domain:       domain,
			Issuer:       "Let's Encrypt / ZeroSSL (acme.sh)",
			Status:       "Active (Let's Encrypt)",
			CertPath:     certPath,
			KeyPath:      keyPath,
			IsSelfSigned: false,
			Message:      "Trusted Let's Encrypt SSL certificate issued and activated successfully.",
		}, nil
	}

	// Fallback to local Self-Signed certificate
	_, _, err := a.GenerateSelfSigned(domain)
	if err != nil {
		return nil, fmt.Errorf("failed to generate fallback SSL certificate: %w", err)
	}

	return &SSLStatus{
		Domain:       domain,
		Issuer:       "Local Self-Signed (Temporary Fallback)",
		Status:       "Self-Signed (Pending DNS / Let's Encrypt Retry)",
		CertPath:     certPath,
		KeyPath:      keyPath,
		IsSelfSigned: true,
		Message:      "DNS verification pending. Self-signed SSL certificate activated as temporary fallback so HTTPS works immediately.",
	}, nil
}
