package services

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"

	"goravel/app/paths"
)

// FTPService manages Pure-FTPd with UnixAuthentication for Linux users and pure-pw for sub-accounts.
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

const pureFTPdConf = "/etc/pure-ftpd/pure-ftpd.conf"

// EnsureConfigured writes Pure-FTPd base configuration if missing.
func (f *FTPService) EnsureConfigured() error {
	f.mu.Lock()
	defer f.mu.Unlock()

	_ = os.MkdirAll("/etc/pure-ftpd", 0755)
	if _, err := os.Stat(pureFTPdConf); err == nil {
		return f.ensurePassiveIPLocked()
	}

	// Passive mode advertises this address to the client, so it has to be the public IP;
	// 127.0.0.1 makes every passive transfer from outside the server hang.
	passiveIP := strings.TrimSpace(NewDNSService().GetSystemIP())
	if passiveIP == "" {
		passiveIP = "127.0.0.1"
	}

	conf := `ChrootEveryone               yes
BrokenClientsCompatibility   no
MaxClientsNumber             50
Daemonize                    yes
VerboseLog                   yes
DisplayDotFiles              yes
AnonymousOnly                no
NoAnonymous                  yes
UnixAuthentication           yes
PassivePortRange             30000 30009
ForcePassiveIP               ` + passiveIP + `
PureDB                       /etc/pure-ftpd/pureftpd.pdb
CreateHomeDir                yes
MaxDiskUsage                   99
CustomerProof                yes
`
	return os.WriteFile(pureFTPdConf, []byte(conf), 0644)
}

// ensurePassiveIPLocked repairs an existing config that still advertises the loopback.
func (f *FTPService) ensurePassiveIPLocked() error {
	body, err := os.ReadFile(pureFTPdConf)
	if err != nil {
		return nil
	}
	publicIP := strings.TrimSpace(NewDNSService().GetSystemIP())
	if publicIP == "" || publicIP == "127.0.0.1" {
		return nil
	}

	lines := strings.Split(string(body), "\n")
	changed := false
	for i, line := range lines {
		if !strings.HasPrefix(strings.TrimSpace(line), "ForcePassiveIP") {
			continue
		}
		if strings.Contains(line, publicIP) {
			return nil
		}
		lines[i] = "ForcePassiveIP               " + publicIP
		changed = true
	}
	if !changed {
		return nil
	}
	if err := os.WriteFile(pureFTPdConf, []byte(strings.Join(lines, "\n")), 0644); err != nil {
		return err
	}
	_ = exec.Command("systemctl", "restart", "pure-ftpd").Run()
	return nil
}

func (f *FTPService) SetPrimaryPassword(username, password string) error {
	if username == "" || username == "root" || password == "" {
		return nil
	}
	if err := f.EnsureConfigured(); err != nil {
		return err
	}
	home := paths.UserHome(username)
	_ = os.MkdirAll(home, 0755)

	passIn := password + "\n" + password + "\n"
	upd := exec.Command("pure-pw", "passwd", username, "-m")
	upd.Stdin = strings.NewReader(passIn)
	if err := upd.Run(); err != nil {
		add := exec.Command("pure-pw", "useradd", username, "-u", username, "-d", home, "-m")
		add.Stdin = strings.NewReader(passIn)
		_ = add.Run()
	}
	_ = exec.Command("pure-pw", "mkdb").Run()
	return nil
}

// EnsurePrimaryAccount ensures the Linux user can authenticate via Pure-FTPd (UnixAuthentication).
func (f *FTPService) EnsurePrimaryAccount(username string) error {
	if err := f.EnsureConfigured(); err != nil {
		return err
	}
	_ = exec.Command("service", "pure-ftpd", "restart").Run()
	_ = exec.Command("systemctl", "restart", "pure-ftpd").Run()
	return nil
}

// CreateSubAccount creates a virtual FTP user jailed under homeDir.
func (f *FTPService) CreateSubAccount(fullUser, password, linuxUser, homeDir string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if err := f.EnsureConfigured(); err != nil {
		return err
	}
	_ = os.MkdirAll(homeDir, 0755)

	// pure-pw useradd with mapped unix uid
	cmd := exec.Command("bash", "-c", fmt.Sprintf(
		`(echo '%s'; echo '%s') | pure-pw useradd %s -u %s -d %s -m 2>/dev/null || (echo '%s'; echo '%s') | pure-pw passwd %s -m`,
		password, password, fullUser, linuxUser, homeDir,
		password, password, fullUser,
	))
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("pure-pw failed: %v — %s", err, string(out))
	}
	_ = exec.Command("pure-pw", "mkdb").Run()
	return nil
}

// DeleteSubAccount removes a virtual FTP user.
func (f *FTPService) DeleteSubAccount(fullUser string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	_ = exec.Command("pure-pw", "userdel", fullUser, "-m").Run()
	_ = exec.Command("pure-pw", "mkdb").Run()
	return nil
}

// ChrootHome sets home directory permissions for FTP chroot (user:user, 0711 on home).
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
