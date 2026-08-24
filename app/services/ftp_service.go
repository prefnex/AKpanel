package services

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

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
	// Servers installed without the FTP component must not be touched, otherwise the boot
	// repair would try to restart a unit that does not exist on every startup.
	if exec.Command("which", "pure-ftpd").Run() != nil {
		return nil
	}

	_ = os.MkdirAll(pureFTPdConfDir, 0755)
	_ = os.MkdirAll(pureFTPdAuthDir, 0755)

	passiveIP := strings.TrimSpace(NewDNSService().GetSystemIPv4())
	if passiveIP == "" {
		passiveIP = "127.0.0.1"
	}

	changed := false
	set := func(name, value string) {
		if f.writeConfFragment(name, value) {
			changed = true
		}
	}

	set("ChrootEveryone", "yes")
	set("NoAnonymous", "yes")
	set("CreateHomeDir", "yes")
	set("DisplayDotFiles", "yes")
	set("VerboseLog", "yes")
	set("MaxClientsNumber", "50")
	set("MaxDiskUsage", "99")
	set("CustomerProof", "yes")
	set("MinUID", "100")
	set("PassivePortRange", "30000 30009")
	set("ForcePassiveIP", passiveIP)
	set("PureDB", pureFTPdPDB)

	// The Debian package ships PAMAuthentication=yes. Dropping the auth symlinks is not
	// enough: pure-ftpd-wrapper also reads these fragments, so PAM has to be turned off
	// by value or virtual PureDB users keep getting rejected with 530.
	set("PAMAuthentication", "no")
	set("UnixAuthentication", "no")

	if err := f.ensureFTPTLSCertLocked(); err == nil {
		set("TLS", "1")
		set("CertFile", pureFTPdTLSCert)
	}

	for _, name := range []string{"65unix", "66pam", "70pam", "71pam"} {
		if err := os.Remove(filepath.Join(pureFTPdAuthDir, name)); err == nil {
			changed = true
		}
	}
	if target, err := os.Readlink(pureFTPdAuthLink); err != nil || target != "../conf/PureDB" {
		_ = os.Remove(pureFTPdAuthLink)
		if os.Symlink("../conf/PureDB", pureFTPdAuthLink) == nil {
			changed = true
		}
	}

	// The wrapper refuses to start if PureDB points at a missing pdb. mkdb is cheap and
	// idempotent, so it has to land before any restart.
	if err := f.ensurePureDBLocked(); err != nil {
		return err
	}

	if changed || f.daemonOlderThanConfig() {
		f.restart()
	}
	return nil
}

func (f *FTPService) ensurePureDBLocked() error {
	passwd := "/etc/pure-ftpd/pureftpd.passwd"
	if _, err := os.Stat(passwd); err != nil {
		_ = os.WriteFile(passwd, []byte(""), 0600)
	}
	if out, err := exec.Command("pure-pw", "mkdb", pureFTPdPDB, "-f", passwd).CombinedOutput(); err != nil {
		if out2, err2 := exec.Command("pure-pw", "mkdb").CombinedOutput(); err2 != nil {
			return fmt.Errorf("pure-pw mkdb failed: %v — %s; fallback: %v — %s",
				err, strings.TrimSpace(string(out)), err2, strings.TrimSpace(string(out2)))
		}
	}
	if _, err := os.Stat(pureFTPdPDB); err != nil {
		return fmt.Errorf("pure-ftpd pdb missing after mkdb: %w", err)
	}
	return nil
}

// writeConfFragment writes a single Debian-style pure-ftpd option and reports whether the
// value on disk actually changed, so the caller can decide about restarting the daemon.
func (f *FTPService) writeConfFragment(name, value string) bool {
	path := filepath.Join(pureFTPdConfDir, name)
	body := strings.TrimSpace(value) + "\n"
	existing, err := os.ReadFile(path)
	if err == nil && string(existing) == body {
		return false
	}
	return os.WriteFile(path, []byte(body), 0644) == nil
}

// daemonOlderThanConfig reports whether pure-ftpd started before the newest config change.
// pure-ftpd-wrapper turns the fragments into command line arguments at startup, so a
// running daemon silently keeps the old authentication method until it is restarted.
func (f *FTPService) daemonOlderThanConfig() bool {
	started, ok := pureFTPdStartTime()
	if !ok {
		return true // not running at all: a restart brings it up with the current config
	}
	newest := time.Time{}
	for _, dir := range []string{pureFTPdConfDir, pureFTPdAuthDir} {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			info, err := e.Info()
			if err != nil {
				continue
			}
			if info.ModTime().After(newest) {
				newest = info.ModTime()
			}
		}
	}
	return !newest.IsZero() && newest.After(started)
}

// pureFTPdStartTime reads the start time of the running daemon. The kernel sets the mtime
// of /proc/<pid> to the process start time, which avoids parsing localized systemd output.
func pureFTPdStartTime() (time.Time, bool) {
	pid := ""
	if out, err := exec.Command("systemctl", "show", "pure-ftpd", "-p", "MainPID", "--value").Output(); err == nil {
		pid = strings.TrimSpace(string(out))
	}
	if pid == "" || pid == "0" {
		if out, err := exec.Command("pgrep", "-o", "-x", "pure-ftpd").Output(); err == nil {
			pid = strings.TrimSpace(strings.SplitN(string(out), "\n", 2)[0])
		}
	}
	if pid == "" || pid == "0" {
		return time.Time{}, false
	}
	info, err := os.Stat("/proc/" + pid)
	if err != nil {
		return time.Time{}, false
	}
	return info.ModTime(), true
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

	// No panel certificate yet (ACME has not run). A self-signed pair still lets clients
	// negotiate explicit FTPS instead of sending credentials in clear text.
	if _, err := os.Stat(pureFTPdTLSCert); err == nil {
		return nil
	}
	return writeSelfSignedPEMBundle(pureFTPdTLSCert, host)
}

// writeSelfSignedPEMBundle creates a cert+key bundle in the single-file layout pure-ftpd
// expects. Used only until a real certificate is issued for the panel hostname.
func writeSelfSignedPEMBundle(path, host string) error {
	if strings.TrimSpace(host) == "" {
		host = "akpanel.local"
	}
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		return err
	}
	tpl := x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: host, Organization: []string{"AKpanel"}},
		DNSNames:              []string{host},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().AddDate(5, 0, 0),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}
	der, err := x509.CreateCertificate(rand.Reader, &tpl, &tpl, &key.PublicKey, key)
	if err != nil {
		return err
	}
	bundle := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	bundle = append(bundle, pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})...)

	_ = os.MkdirAll(filepath.Dir(path), 0700)
	return os.WriteFile(path, bundle, 0600)
}

// restart uses a full restart on purpose: reloading pure-ftpd does not rebuild the
// wrapper's command line, so a reload would keep the stale authentication method.
func (f *FTPService) restart() {
	runTimeout(30*time.Second, "systemctl", "restart", "pure-ftpd")
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
	if err := f.EnsureConfigured(); err != nil {
		return err
	}
	home := paths.UserHome(username)
	_ = os.MkdirAll(home, 0755)
	_ = ChrootHome(username)

	show := exec.Command("pure-pw", "show", username)
	if show.Run() == nil {
		return nil
	}

	// A placeholder password is replaced immediately by SetPrimaryPassword in the
	// same provisioning step. The account has to exist so mkdb produces a pdb the
	// wrapper will accept on restart.
	placeholder := "akpanel-" + username
	passIn := placeholder + "\n" + placeholder + "\n"
	add := exec.Command("pure-pw", "useradd", username, "-u", username, "-d", home, "-m")
	add.Stdin = strings.NewReader(passIn)
	if out, err := add.CombinedOutput(); err != nil {
		return fmt.Errorf("pure-pw useradd %s: %v — %s", username, err, strings.TrimSpace(string(out)))
	}
	if out, err := exec.Command("pure-pw", "mkdb").CombinedOutput(); err != nil {
		return fmt.Errorf("pure-pw mkdb failed: %v — %s", err, string(out))
	}
	return nil
}

func (f *FTPService) CreateSubAccount(fullUser, password, linuxUser, homeDir string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if err := f.ensureConfiguredLocked(); err != nil {
		return err
	}
	_ = os.MkdirAll(homeDir, 0755)

	// The password is fed through stdin, never interpolated into a shell command: a
	// password containing a quote would otherwise break the command or inject into it.
	passIn := password + "\n" + password + "\n"
	add := exec.Command("pure-pw", "useradd", fullUser, "-u", linuxUser, "-d", homeDir, "-m")
	add.Stdin = strings.NewReader(passIn)
	if out, err := add.CombinedOutput(); err != nil {
		upd := exec.Command("pure-pw", "passwd", fullUser, "-m")
		upd.Stdin = strings.NewReader(passIn)
		if updOut, updErr := upd.CombinedOutput(); updErr != nil {
			return fmt.Errorf("pure-pw useradd failed: %v — %s; passwd fallback failed: %v — %s",
				err, strings.TrimSpace(string(out)), updErr, strings.TrimSpace(string(updOut)))
		}
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

// EnsureBruteForceProtection registers a fail2ban jail for pure-ftpd. Port 21 is scanned
// and dictionary-attacked continuously, and pure-ftpd itself has no rate limiting.
func (f *FTPService) EnsureBruteForceProtection() {
	if exec.Command("which", "fail2ban-client").Run() != nil {
		return
	}
	jail := `# Managed by AKpanel — edits are overwritten.
[pure-ftpd]
enabled = true
port = ftp,ftp-data,ftps,ftps-data
filter = pure-ftpd
backend = systemd
maxretry = 5
findtime = 600
bantime = 3600
`
	_ = os.MkdirAll("/etc/fail2ban/jail.d", 0755)
	if writeIfChanged("/etc/fail2ban/jail.d/akpanel-pureftpd.conf", jail, 0644) {
		runTimeout(20*time.Second, "fail2ban-client", "reload")
	}
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
	return FTPServerInfo{
		Host:       host,
		Port:       21,
		PassiveMin: 30000,
		PassiveMax: 30009,
		TLSEnabled: ftpTLSActive(),
	}
}

// ftpTLSActive reports whether clients can really negotiate FTPS right now. Checking only
// for the certificate file made the panel advertise TLS while the running daemon had never
// loaded it, so the badge contradicted what FTP clients reported.
func ftpTLSActive() bool {
	body, err := os.ReadFile(filepath.Join(pureFTPdConfDir, "TLS"))
	if err != nil {
		return false
	}
	switch strings.TrimSpace(string(body)) {
	case "1", "2", "3":
	default:
		return false
	}
	if _, err := os.Stat(pureFTPdTLSCert); err != nil {
		return false
	}
	out, err := exec.Command("systemctl", "is-active", "pure-ftpd").Output()
	if err != nil {
		return exec.Command("pgrep", "-x", "pure-ftpd").Run() == nil
	}
	return strings.TrimSpace(string(out)) == "active"
}
