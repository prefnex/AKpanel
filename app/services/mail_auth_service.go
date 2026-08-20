package services

import (
	"crypto/sha512"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"
)

// MailAuthService manages Dovecot passwd-file authentication for virtual mailboxes.
type MailAuthService struct {
	mu       sync.Mutex
	passwdFile string
	confFile   string
}

var (
	mailAuthOnce     sync.Once
	mailAuthInstance *MailAuthService
)

func GetMailAuthService() *MailAuthService {
	mailAuthOnce.Do(func() {
		mailAuthInstance = &MailAuthService{
			passwdFile: "/etc/dovecot/akpanel-passwd",
			confFile:   "/etc/dovecot/conf.d/99-akpanel-auth.conf",
		}
	})
	return mailAuthInstance
}

func (m *MailAuthService) EnsureDovecotConfig() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	_ = os.MkdirAll("/etc/dovecot/conf.d", 0755)
	_ = os.MkdirAll("/var/vmail", 0755)

	if _, err := os.Stat(m.passwdFile); os.IsNotExist(err) {
		_ = os.WriteFile(m.passwdFile, []byte(""), 0600)
	}

	conf := `passdb {
  driver = passwd-file
  args = scheme=SHA512-CRYPT username_format=%u /etc/dovecot/akpanel-passwd
}
userdb {
  driver = static
  args = uid=vmail gid=vmail home=/var/vmail/%d/%n
}
`
	if err := os.WriteFile(m.confFile, []byte(conf), 0644); err != nil {
		return err
	}

	_ = exec.Command("service", "dovecot", "reload").Run()
	return nil
}

func (m *MailAuthService) hashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		// fallback SHA512 crypt style prefix for dovecot
		h := sha512.Sum512([]byte(password))
		return fmt.Sprintf("{SHA512}%x", h), nil
	}
	return string(b), nil
}

// SetMailboxPassword adds or updates a mailbox password in Dovecot passwd-file.
func (m *MailAuthService) SetMailboxPassword(email, password string) error {
	if err := m.EnsureDovecotConfig(); err != nil {
		return err
	}

	hash, err := m.hashPassword(password)
	if err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	content, _ := os.ReadFile(m.passwdFile)
	lines := strings.Split(string(content), "\n")
	found := false
	var out []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) >= 1 && parts[0] == email {
			out = append(out, fmt.Sprintf("%s:%s", email, hash))
			found = true
		} else {
			out = append(out, line)
		}
	}
	if !found {
		out = append(out, fmt.Sprintf("%s:%s", email, hash))
	}
	return os.WriteFile(m.passwdFile, []byte(strings.Join(out, "\n")+"\n"), 0600)
}

// RemoveMailboxPassword removes an entry from passwd-file.
func (m *MailAuthService) RemoveMailboxPassword(email string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	content, _ := os.ReadFile(m.passwdFile)
	lines := strings.Split(string(content), "\n")
	var out []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, email+":") {
			out = append(out, line)
		}
	}
	return os.WriteFile(m.passwdFile, []byte(strings.Join(out, "\n")+"\n"), 0600)
}

// EnsurePostfixVirtualConfig applies virtual mailbox domain settings.
func (m *MailAuthService) EnsurePostfixVirtualConfig() error {
	_ = exec.Command("postconf", "-e", "virtual_mailbox_domains=/etc/postfix/vmailbox_domains").Run()
	_ = exec.Command("postconf", "-e", "virtual_mailbox_maps=hash:/etc/postfix/vmailbox").Run()
	_ = exec.Command("postconf", "-e", "virtual_uid_maps=static:5000").Run()
	_ = exec.Command("postconf", "-e", "virtual_gid_maps=static:5000").Run()
	_ = exec.Command("service", "postfix", "reload").Run()
	return nil
}
