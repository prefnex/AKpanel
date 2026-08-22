package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"goravel/app/paths"
)

// FTPService manages Pure-FTPd virtual users via pure-pw / PureDB (Debian conf.d layout).
type FTPService struct {
	mu sync.Mutex
}

var (
	ftpServiceInstance *FTPService
	ftpOnce            sync.Once
)

func GetFTPService() *FTPService {
	ftpOnce.Do(func() {
		ftpServiceInstance = &FTPService{}
	})
	return ftpServiceInstance
}

const (
	pureFTPdConfDir  = "/etc/pure-ftpd/conf"
	pureFTPdAuthDir  = "/etc/pure-ftpd/auth"
	pureFTPdPDB      = "/etc/pure-ftpd/pureftpd.pdb"
	pureFTPdTLSCert  = "/etc/ssl/private/pure-ftpd.pem"
	pureFTPdAuthLink = "/etc/pure-ftpd/auth/50puredb"
)

// EnsureConfigured writes Pure-FTPd Debian-style fragments and auth symlinks.
func (f *FTPService) EnsureConfigured() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.ensureConfiguredLocked()
}

func (f *FTPService) ensureConfiguredLocked() error {
	_ = os.MkdirAll(pureFTPdConfDir, 0755)
	_ = os.MkdirAll(pureFTPdAuthDir, 0755)

	passiveIP := strings.TrimSpace(NewDNSService().GetSystemIP())
	if passiveIP == "" {
		passiveIP = "127.0.0.1"
	}

	_ = f.writeConfFragment("ChrootEveryone", "yes")
	_ = f.writeConfFragment("NoAnonymous", "yes")
	_ = f.writeConfFragment("CreateHomeDir", "yes")
	_ = f.writeConfFragment("DisplayDotFiles", "yes")
	_ = f.writeConfFragment("VerboseLog", "yes")
	_ = f.writeConfFragment("MaxClientsNumber", "50")
	_ = f.writeConfFragment("MaxDiskUsage", "99")
	_ = f.writeConfFragment("CustomerProof", "yes")
	_ = f.writeConfFragment("MinUID", "100")
	_ = f.writeConfFragment("PassivePortRange", "30000 30009")
	_ = f.writeConfFragment("ForcePassiveIP", passiveIP)
	_ = f.writeConfFragment("PureDB", pureFTPdPDB)

	if err := f.ensureFTPTLSCertLocked(); err == nil {
		_ = f.writeConfFragment("TLS", "1")
		_ = f.writeConfFragment("CertFile", pureFTPdTLSCert)
	}

	for _, name := range []string{"65unix", "66pam", "70pam", "71pam"} {
		_ = os.Remove(filepath.Join(pureFTPdAuthDir, name))
	}
	_ = os.Remove(pureFTPdAuthLink)
	_ = os.Symlink("../conf/PureDB", pureFTPdAuthLink)

	return f.ensurePassiveIPLocked()
}

func (f *FTPService) writeConfFragment(name, value string) error {
	path := filepath.Join(pureFTPdConfDir, name)
	body := strings.TrimSpace(value) + "\n"
	existing, err := os.ReadFile(path)
	if err == nil && string(existing) == body {
		return nil
	}
	return os.WriteFile(path, []byte(body), 0644)
}

func (f *FTPService) ensureFTPTLSCertLocked() error {
	candidates := []struct{ cert, key string }{
		{"/etc/akpanel/ssl/server/fullchain.pem", "/etc/akpanel/ssl/server/privkey.pem"},
	}
	host := strings.TrimSpace(NewDNSService().GetSystemHostname())
	if strings.Contains(host, ".") {
		candidates = append(candidates, struct{ cert, key string }{
			"/etc/akpanel/ssl/" + host + "/fullchain.pem",
			"/etc/akpanel/ssl/" + host + "/privkey.pem",
		})
	}
	for _, c := range candidates {
		if _, err := os.Stat(c.cert); err != nil {
			continue
		}
		if _, err := os.Stat(c.key); err != nil {
			continue
		}
		certPEM, _ := os.ReadFile(c.cert)
		keyPEM, _ := os.ReadFile(c.key)
		combined := append(certPEM, keyPEM...)
		_ = os.MkdirAll(filepath.Dir(pureFTPdTLSCert), 0700)
		return os.WriteFile(pureFTPdTLSCert, combined, 0600)
	}
	return fmt.Errorf("no TLS certificate available for pure-ftpd")
}

func (f *FTPService) restartIfNeeded() {
	_ = exec.Command("systemctl", "try-reload-or-restart", "pure-ftpd").Run()
}

func (f *FTPService) ensurePassiveIPLocked() error {
	publicIP := strings.TrimSpace(NewDNSService().GetSystemIP())
	if publicIP == "" || publicIP == "127.0.0.1" {
		return nil
	}
	path := filepath.Join(pureFTPdConfDir, "ForcePassiveIP")
	body, err := os.ReadFile(path)
	if err == nil && strings.TrimSpace(string(body)) == publicIP {
		return nil
	}
	if err := f.writeConfFragment("ForcePassiveIP", publicIP); err != nil {
		return err
	}
	f.restartIfNeeded()
	return nil
}

func (f *FTPService) SetPrimaryPassword(username, password string) error {
	if username == "" || username == "root" || password == "" {
		return nil
	}
	if err := f.EnsureConfigured(); err != nil {
		return err
	}
	_ = ChrootHome(username)
	home := paths.UserHome(username)
	_ = os.MkdirAll(home, 0755)

	passIn := password + "\n" + password + "\n"
	upd := exec.Command("pure-pw", "passwd", username, "-m")
	upd.Stdin = strings.NewReader(passIn)
	if err := upd.Run(); err != nil {
		add := exec.Command("pure-pw", "useradd", username, "-u", username, "-d", home, "-m")
		add.Stdin = strings.NewReader(passIn)
		if out, addErr := add.CombinedOutput(); addErr != nil {
			return fmt.Errorf("pure-pw useradd failed: %v — %s", addErr, string(out))
		}
	}
	if out, err := exec.Command("pure-pw", "mkdb").CombinedOutput(); err != nil {
		return fmt.Errorf("pure-pw mkdb failed: %v — %s", err, string(out))
	}
	return nil
}

func (f *FTPService) EnsurePrimaryAccount(username string) error {
	if username == "" || username == "root" {
		return nil
	}
	return f.EnsureConfigured()
}

func (f *FTPService) CreateSubAccount(fullUser, password, linuxUser, homeDir string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if err := f.ensureConfiguredLocked(); err != nil {
		return err
	}
	_ = os.MkdirAll(homeDir, 0755)

	cmd := exec.Command("bash", "-c", fmt.Sprintf(
		`(echo '%s'; echo '%s') | pure-pw useradd %s -u %s -d %s -m 2>/dev/null || (echo '%s'; echo '%s') | pure-pw passwd %s -m`,
		password, password, fullUser, linuxUser, homeDir,
		password, password, fullUser,
	))
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("pure-pw failed: %v — %s", err, string(out))
	}
	if out, err := exec.Command("pure-pw", "mkdb").CombinedOutput(); err != nil {
		return fmt.Errorf("pure-pw mkdb failed: %v — %s", err, string(out))
	}
	return nil
}

func (f *FTPService) DeleteSubAccount(fullUser string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	_ = exec.Command("pure-pw", "userdel", fullUser, "-m").Run()
	_ = exec.Command("pure-pw", "mkdb").Run()
	return nil
}

func (f *FTPService) EnsurePassiveFirewall() {
	if exec.Command("which", "ufw").Run() != nil {
		return
	}
	status, _ := exec.Command("ufw", "status").CombinedOutput()
	if !strings.Contains(string(status), "Status: active") {
		return
	}
	_ = exec.Command("ufw", "allow", "21/tcp", "comment", "FTP Service").Run()
	_ = exec.Command("ufw", "allow", "30000:30009/tcp", "comment", "FTP Passive Range").Run()
}

func ChrootHome(username string) error {
	home := paths.UserHome(username)
	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", username, username), home).Run()
	_ = exec.Command("chmod", "711", paths.UserHomes).Run()
	_ = exec.Command("chmod", "711", home).Run()
	domainsDir := fmt.Sprintf("%s/domains", home)
	if _, err := os.Stat(domainsDir); err == nil {
		_ = exec.Command("chmod", "-R", "755", domainsDir).Run()
	}
	return nil
}

type FTPServerInfo struct {
	Host       string `json:"host"`
	Port       int    `json:"port"`
	PassiveMin int    `json:"passive_min"`
	PassiveMax int    `json:"passive_max"`
	TLSEnabled bool   `json:"tls_enabled"`
}

func (f *FTPService) ServerInfo(domain string) FTPServerInfo {
	host := strings.TrimSpace(domain)
	if host != "" {
		if !strings.HasPrefix(host, "ftp.") {
			host = "ftp." + host
		}
	} else {
		host = strings.TrimSpace(NewDNSService().GetSystemIP())
	}
	if host == "" {
		host = "127.0.0.1"
	}
	tlsEnabled := false
	if _, err := os.Stat(pureFTPdTLSCert); err == nil {
		tlsEnabled = true
	}
	return FTPServerInfo{
		Host:       host,
		Port:       21,
		PassiveMin: 30000,
		PassiveMax: 30009,
		TLSEnabled: tlsEnabled,
	}
}
