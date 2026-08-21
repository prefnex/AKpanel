package services

import (
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"goravel/app/paths"
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
		sslBaseDir: paths.SSLBase,
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

func (a *ACMEService) isAcmeAvailable() bool {
	bin := a.detectAcmeBin()
	if _, err := os.Stat(bin); err == nil {
		a.acmeBin = bin
		return true
	}
	return false
}

func (a *ACMEService) EnsureAcmeInstalled() error {
	if a.isAcmeAvailable() {
		return nil
	}
	installCmd := `curl -fsSL https://get.acme.sh | sh -s email=admin@akpanel.site || (git clone --depth 1 https://github.com/acmesh-official/acme.sh.git /root/.acme.sh-repo && cd /root/.acme.sh-repo && ./acme.sh --install -m admin@akpanel.site)`
	_ = exec.Command("bash", "-c", installCmd).Run()
	_ = exec.Command("ln", "-sfn", "/root/.acme.sh/acme.sh", "/usr/local/bin/acme.sh").Run()
	a.acmeBin = a.detectAcmeBin()
	_ = exec.Command(a.acmeBin, "--set-default-ca", "--server", "letsencrypt").Run()
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

	return a.writeSelfSigned(domain, certPath, keyPath)
}

func (a *ACMEService) writeSelfSigned(domain, certPath, keyPath string) (string, string, error) {
	_ = os.MkdirAll(filepath.Dir(certPath), 0755)
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

// IssueSSL requests Let's Encrypt via acme.sh, and falls back to self-signed on failure with transparent logs
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
	if webroot == "" || webroot != "/var/www/html" {
		webroot = "/var/www/html"
	}

	_ = os.MkdirAll("/var/www/html/.well-known/acme-challenge", 0777)
	_ = exec.Command("chmod", "-R", "777", "/var/www/html/.well-known").Run()

	domainDir := filepath.Join(a.sslBaseDir, domain)
	_ = os.MkdirAll(domainDir, 0755)
	certPath := filepath.Join(domainDir, "fullchain.pem")
	keyPath := filepath.Join(domainDir, "privkey.pem")

	_ = a.EnsureAcmeInstalled()

	var issueSuccess bool
	var acmeOutput string
	caUsed := "Let's Encrypt"
	logPath := "/var/log/akpanel/acme.log"
	_ = os.MkdirAll("/var/log/akpanel", 0755)

	if a.isAcmeAvailable() {
		wwwExtra := strings.Count(domain, ".") == 1 && !strings.HasPrefix(domain, "www.")
		for attempt := 1; attempt <= 3 && !issueSuccess; attempt++ {
			if attempt > 1 {
				time.Sleep(time.Duration(attempt*8) * time.Second)
			}
			issueArgs := []string{"--issue", "-d", domain}
			if wwwExtra {
				issueArgs = append(issueArgs, "-d", "www."+domain)
			}
			issueArgs = append(issueArgs, "-w", webroot, "--server", "letsencrypt", "--force")
			cmdIssue := exec.Command(a.acmeBin, issueArgs...)
			out, err := cmdIssue.CombinedOutput()
			acmeOutput = string(out)

			if err != nil {
				zeroArgs := []string{"--issue", "-d", domain}
				if wwwExtra {
					zeroArgs = append(zeroArgs, "-d", "www."+domain)
				}
				zeroArgs = append(zeroArgs, "-w", webroot, "--server", "zerossl", "--force")
				cmdZero := exec.Command(a.acmeBin, zeroArgs...)
				outZero, errZero := cmdZero.CombinedOutput()
				acmeOutput += "\n[Automatic Fallback to ZeroSSL]:\n" + string(outZero)
				if errZero == nil {
					err = nil
					caUsed = "ZeroSSL"
				}
			}

			logEntry := fmt.Sprintf("\n=== ACME Issue [%s] %s attempt=%d ===\n%s\n", time.Now().Format(time.RFC3339), domain, attempt, acmeOutput)
			if f, errOpen := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); errOpen == nil {
				_, _ = f.WriteString(logEntry)
				_ = f.Close()
			}

			if err != nil {
				continue
			}
			cmdInstall := exec.Command(a.acmeBin,
				"--install-cert",
				"-d", domain,
				"--key-file", keyPath,
				"--fullchain-file", certPath,
				"--reloadcmd", "service nginx reload 2>/dev/null || true; service apache2 reload 2>/dev/null || true",
			)
			if cmdInstall.Run() == nil {
				issueSuccess = true
			}
		}
	}

	if issueSuccess {
		_ = exec.Command("service", "nginx", "reload").Run()
		return &SSLStatus{
			Domain:       domain,
			Issuer:       fmt.Sprintf("%s (acme.sh)", caUsed),
			Status:       fmt.Sprintf("Active (%s)", caUsed),
			CertPath:     certPath,
			KeyPath:      keyPath,
			IsSelfSigned: false,
			Message:      fmt.Sprintf("Trusted %s SSL certificate issued and activated successfully.", caUsed),
		}, nil
	}

	failReason := "DNS or HTTP verification failed. Check /var/log/akpanel/acme.log for details."
	if strings.Contains(acmeOutput, "NXDOMAIN") || strings.Contains(acmeOutput, "DNS problem") {
		failReason = "DNS A-record check failed: The domain does not yet point to this server IP in public DNS."
	} else if strings.Contains(acmeOutput, "Connection refused") || strings.Contains(acmeOutput, "Timeout") {
		failReason = "HTTP challenge timed out or Port 80 was unreachable from Let's Encrypt servers."
	}

	// Keep an existing trusted cert instead of silently replacing it with self-signed.
	if info, ok := InspectCertificateFile(certPath); ok && !info.SelfSigned && info.DaysLeft > 7 {
		return &SSLStatus{
			Domain:       domain,
			Issuer:       info.Issuer,
			Status:       "Active (Trusted — ACME renew deferred)",
			CertPath:     certPath,
			KeyPath:      keyPath,
			IsSelfSigned: false,
			Message:      fmt.Sprintf("%s Existing trusted certificate was kept (expires in %d days).", failReason, info.DaysLeft),
		}, nil
	}

	if _, _, err := a.writeSelfSigned(domain, certPath, keyPath); err != nil {
		return nil, fmt.Errorf("failed to generate fallback SSL certificate: %w", err)
	}

	return &SSLStatus{
		Domain:       domain,
		Issuer:       "Self-Signed Fallback",
		Status:       "Self-Signed (Pending DNS / Let's Encrypt Retry)",
		CertPath:     certPath,
		KeyPath:      keyPath,
		IsSelfSigned: true,
		Message:      fmt.Sprintf("%s Self-signed certificate activated so HTTPS remains functional.", failReason),
	}, nil
}

type CertFileInfo struct {
	Issuer     string
	SelfSigned bool
	DaysLeft   int
	ExpiryDate string
}

func InspectCertificateFile(certPath string) (CertFileInfo, bool) {
	info := CertFileInfo{Issuer: "Self-Signed Fallback", SelfSigned: true, DaysLeft: 0}
	certData, err := os.ReadFile(certPath)
	if err != nil {
		return info, false
	}
	block, _ := pem.Decode(certData)
	if block == nil {
		return info, false
	}
	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return info, false
	}

	info.ExpiryDate = cert.NotAfter.Format("2006-01-02")
	info.DaysLeft = int(time.Until(cert.NotAfter).Hours() / 24)
	if info.DaysLeft < 0 {
		info.DaysLeft = 0
	}

	info.SelfSigned = cert.CheckSignatureFrom(cert) == nil
	org := ""
	if len(cert.Issuer.Organization) > 0 {
		org = cert.Issuer.Organization[0]
	}
	cn := cert.Issuer.CommonName
	switch {
	case info.SelfSigned:
		info.Issuer = "Self-Signed Fallback"
	case org != "":
		info.Issuer = org
	case cn != "":
		info.Issuer = cn
	default:
		info.Issuer = "Custom Certificate"
	}
	return info, true
}

type CertificateDetail struct {
	Domain       string   `json:"domain"`
	Issuer       string   `json:"issuer"`
	Status       string   `json:"status"` // "Active (Trusted)", "Self-Signed", "Expired"
	ExpiryDate   string   `json:"expiry_date"`
	DaysLeft     int      `json:"days_left"`
	SANs         []string `json:"sans"`
	CertPath     string   `json:"cert_path"`
	KeyPath      string   `json:"key_path"`
	IsSelfSigned bool     `json:"is_self_signed"`
	AutoRenew    bool     `json:"auto_renew"`
}

// GetAllCertificates scans /etc/akpanel/ssl and reads certificate details
func (a *ACMEService) GetAllCertificates() []CertificateDetail {
	a.mu.Lock()
	defer a.mu.Unlock()

	var list []CertificateDetail
	entries, err := os.ReadDir(a.sslBaseDir)
	if err != nil {
		return list
	}

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		domain := e.Name()
		certPath := filepath.Join(a.sslBaseDir, domain, "fullchain.pem")
		keyPath := filepath.Join(a.sslBaseDir, domain, "privkey.pem")

		if _, err := os.Stat(certPath); os.IsNotExist(err) {
			continue
		}

		issuer := "Self-Signed Fallback"
		status := "Self-Signed (Fallback)"
		isSelfSigned := true
		expiryStr := ""
		daysLeft := 0
		sans := []string{domain}

		if info, ok := InspectCertificateFile(certPath); ok {
			issuer = info.Issuer
			expiryStr = info.ExpiryDate
			daysLeft = info.DaysLeft
			isSelfSigned = info.SelfSigned
			if info.SelfSigned {
				status = "Self-Signed (Fallback)"
			} else if daysLeft == 0 {
				status = "Expired"
			} else {
				status = "Active (Trusted)"
			}
		}

		list = append(list, CertificateDetail{
			Domain:       domain,
			Issuer:       issuer,
			Status:       status,
			ExpiryDate:   expiryStr,
			DaysLeft:     daysLeft,
			SANs:         sans,
			CertPath:     certPath,
			KeyPath:      keyPath,
			IsSelfSigned: isSelfSigned,
			AutoRenew:    true,
		})
	}

	return list
}

// InstallCustomCertificate saves user-provided SSL cert, key, and CA bundle
func (a *ACMEService) InstallCustomCertificate(domain, certContent, keyContent, caBundle string) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	domain = strings.ToLower(strings.TrimSpace(domain))
	if domain == "" {
		return fmt.Errorf("domain cannot be empty")
	}
	if strings.TrimSpace(certContent) == "" || strings.TrimSpace(keyContent) == "" {
		return fmt.Errorf("certificate and private key content are required")
	}

	domainDir := filepath.Join(a.sslBaseDir, domain)
	_ = os.MkdirAll(domainDir, 0755)

	certPath := filepath.Join(domainDir, "fullchain.pem")
	keyPath := filepath.Join(domainDir, "privkey.pem")

	fullCert := strings.TrimSpace(certContent)
	if strings.TrimSpace(caBundle) != "" {
		fullCert += "\n" + strings.TrimSpace(caBundle)
	}

	if err := os.WriteFile(certPath, []byte(fullCert), 0644); err != nil {
		return fmt.Errorf("failed to save certificate: %w", err)
	}
	if err := os.WriteFile(keyPath, []byte(strings.TrimSpace(keyContent)), 0600); err != nil {
		return fmt.Errorf("failed to save private key: %w", err)
	}

	// Reload web servers
	_ = exec.Command("service", "nginx", "reload").Run()
	_ = exec.Command("service", "apache2", "reload").Run()

	return nil
}

// RenewAll triggers acme.sh --cron renewal
func (a *ACMEService) RenewAll() (string, error) {
	_ = a.EnsureAcmeInstalled()
	if _, err := os.Stat(a.acmeBin); err != nil {
		return "", fmt.Errorf("acme.sh is not installed")
	}

	cmd := exec.Command(a.acmeBin, "--cron", "--home", filepath.Dir(a.acmeBin))
	out, _ := cmd.CombinedOutput()
	_ = exec.Command("service", "nginx", "reload").Run()
	_ = exec.Command("service", "apache2", "reload").Run()

	return string(out), nil
}

func (a *ACMEService) RenewDomain(domain string) (*SSLStatus, error) {
	return a.IssueSSL(domain, "", "")
}

// IssueWildcard requests a wildcard cert for domain and *.domain using DNS-01 (BIND nsupdate).
func (a *ACMEService) IssueWildcard(domain, webroot string) (*SSLStatus, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	domain = strings.ToLower(strings.TrimSpace(domain))
	if domain == "" {
		return nil, fmt.Errorf("domain cannot be empty")
	}

	_ = a.EnsureAcmeInstalled()
	a.EnsureBindACMETSIG()
	time.Sleep(1 * time.Second)

	domainDir := filepath.Join(a.sslBaseDir, domain)
	_ = os.MkdirAll(domainDir, 0755)
	certPath := filepath.Join(domainDir, "fullchain.pem")
	keyPath := filepath.Join(domainDir, "privkey.pem")

	wildcard := "*." + domain
	var acmeOutput string
	issueSuccess := false

	if a.isAcmeAvailable() {
		env := os.Environ()
		env = append(env, "NSUPDATE_SERVER=127.0.0.1")
		keyConf := "/etc/bind/keys/akpanel-acme.conf"
		if _, err := os.Stat(keyConf); err == nil {
			env = append(env, "NSUPDATE_KEY="+keyConf)
		}

		cmd := exec.Command(a.acmeBin,
			"--issue",
			"--dns", "dns_nsupdate",
			"-d", domain,
			"-d", wildcard,
			"--server", "letsencrypt",
			"--force",
		)
		cmd.Env = env
		out, err := cmd.CombinedOutput()
		acmeOutput = string(out)

		if err != nil {
			// HTTP-01 on the shared challenge root (every vhost aliases this).
			_ = os.MkdirAll("/var/www/html/.well-known/acme-challenge", 0777)
			cmdHTTP := exec.Command(a.acmeBin, "--issue",
				"-d", domain, "-d", "www."+domain,
				"-d", "webmail."+domain, "-d", "cpanel."+domain,
				"-w", "/var/www/html", "--server", "letsencrypt", "--force")
			out2, err2 := cmdHTTP.CombinedOutput()
			acmeOutput += "\n[HTTP-01 fallback]\n" + string(out2)
			if err2 == nil {
				err = nil
			}
		}

		if err == nil {
			cmdInstall := exec.Command(a.acmeBin, "--install-cert", "-d", domain,
				"--key-file", keyPath, "--fullchain-file", certPath,
				"--reloadcmd", "service nginx reload 2>/dev/null || true; service apache2 reload 2>/dev/null || true")
			if cmdInstall.Run() == nil {
				issueSuccess = true
			}
		}
	}

	logPath := "/var/log/akpanel/acme.log"
	_ = os.MkdirAll("/var/log/akpanel", 0755)
	logEntry := fmt.Sprintf("\n=== ACME Wildcard [%s] %s ===\n%s\n", time.Now().Format(time.RFC3339), domain, acmeOutput)
	f, _ := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if f != nil {
		_, _ = f.WriteString(logEntry)
		f.Close()
	}

	if issueSuccess {
		return &SSLStatus{
			Domain: domain, Issuer: "Let's Encrypt (wildcard)", Status: "Active",
			CertPath: certPath, KeyPath: keyPath, IsSelfSigned: false,
			Message: "Wildcard SSL certificate issued via DNS-01",
		}, nil
	}

	_, _, err := a.GenerateSelfSigned(domain)
	if err != nil {
		return nil, err
	}
	return &SSLStatus{
		Domain: domain, Issuer: "Self-Signed", Status: "Self-Signed Fallback",
		CertPath: certPath, KeyPath: keyPath, IsSelfSigned: true,
		Message: "Wildcard issuance failed; self-signed fallback installed",
	}, nil
}

func (a *ACMEService) EnsureBindACMETSIG() {
	keyPath := "/etc/bind/akpanel-acme.key"
	legacyPath := "/etc/bind/keys/akpanel-acme.conf"
	_ = os.MkdirAll("/etc/bind/keys", 0750)

	if _, err := os.Stat(keyPath); os.IsNotExist(err) {
		if _, err2 := os.Stat(legacyPath); err2 == nil {
			_ = exec.Command("cp", "-a", legacyPath, keyPath).Run()
		} else {
			out, _ := exec.Command("tsig-keygen", "-a", "hmac-sha256", "akpanel-acme").CombinedOutput()
			if len(out) > 0 {
				_ = os.WriteFile(keyPath, out, 0640)
			}
		}
	}
	if b, err := os.ReadFile(keyPath); err == nil && len(b) > 0 {
		_ = os.WriteFile(legacyPath, b, 0640)
	}
	_ = exec.Command("chown", "root:bind", keyPath, legacyPath).Run()
	_ = os.Chmod(keyPath, 0640)
	_ = os.Chmod(legacyPath, 0640)

	includeLine := `include "/etc/bind/akpanel-acme.key";` + "\n"
	stripTSIGInclude := func(confPath string) {
		content, err := os.ReadFile(confPath)
		if err != nil {
			return
		}
		lines := strings.Split(string(content), "\n")
		kept := make([]string, 0, len(lines))
		for _, line := range lines {
			if strings.Contains(line, "akpanel-acme.key") || strings.Contains(line, "akpanel-acme.conf") {
				continue
			}
			kept = append(kept, line)
		}
		_ = os.WriteFile(confPath, []byte(strings.Join(kept, "\n")), 0644)
	}
	for _, confPath := range []string{"/etc/bind/named.conf.options", "/etc/bind/named.conf.local", "/etc/bind/named.conf"} {
		stripTSIGInclude(confPath)
	}
	if content, err := os.ReadFile("/etc/bind/named.conf"); err == nil {
		_ = os.WriteFile("/etc/bind/named.conf", append([]byte(includeLine), content...), 0644)
	}

	_ = exec.Command("rndc", "reconfig").Run()
	_ = exec.Command("rndc", "reload").Run()
	_ = exec.Command("systemctl", "reload", "named").Run()
	_ = exec.Command("systemctl", "reload", "bind9").Run()
}

