package services

import (
	"context"
	"crypto/sha512"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// MailAuthService manages Dovecot passwd-file authentication for virtual mailboxes.
type MailAuthService struct {
	mu         sync.Mutex
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
	uid, gid := ensureVmailIdentity()

	if _, err := os.Stat(m.passwdFile); os.IsNotExist(err) {
		_ = os.WriteFile(m.passwdFile, []byte(""), 0600)
	}

	conf := fmt.Sprintf(`auth_master_user_separator = *

passdb {
  driver = passwd-file
  args = scheme=SHA512-CRYPT username_format=%%u /etc/dovecot/akpanel-master-users
  master = yes
}

passdb {
  driver = passwd-file
  args = scheme=SHA512-CRYPT username_format=%%u /etc/dovecot/akpanel-passwd
}
userdb {
  driver = static
  args = uid=%s gid=%s home=/var/vmail/%%d/%%n
}
`, uid, gid)
	m.ensureMasterUserLocked()
	authChanged := writeIfChanged(m.confFile, conf, 0644)
	listenChanged := m.writeDovecotListenersLocked()
	m.ensurePostfixMailStackLocked(uid, gid)

	if authChanged || listenChanged {
		runTimeout(8*time.Second, "systemctl", "reload", "dovecot")
	}
	return nil
}

func writeIfChanged(path, body string, mode os.FileMode) bool {
	old, _ := os.ReadFile(path)
	if string(old) == body {
		return false
	}
	return os.WriteFile(path, []byte(body), mode) == nil
}

func runTimeout(d time.Duration, name string, args ...string) {
	ctx, cancel := context.WithTimeout(context.Background(), d)
	defer cancel()
	_ = exec.CommandContext(ctx, name, args...).Run()
}

// ensureVmailIdentity creates the vmail system user and returns numeric uid/gid.
// Dovecot static userdb rejects names like uid=vmail ("Invalid UID value").
func ensureVmailIdentity() (uid, gid string) {
	_ = os.MkdirAll("/var/vmail", 0755)
	if exec.Command("getent", "group", "vmail").Run() != nil {
		if exec.Command("groupadd", "-g", "5000", "vmail").Run() != nil {
			_ = exec.Command("groupadd", "vmail").Run()
		}
	}
	if exec.Command("id", "vmail").Run() != nil {
		if exec.Command("useradd", "-g", "vmail", "-u", "5000", "-d", "/var/vmail", "-M", "-s", "/usr/sbin/nologin", "vmail").Run() != nil {
			_ = exec.Command("useradd", "-g", "vmail", "-d", "/var/vmail", "-M", "-s", "/usr/sbin/nologin", "vmail").Run()
		}
	}
	uid, gid = "5000", "5000"
	if out, err := exec.Command("id", "-u", "vmail").Output(); err == nil {
		if s := strings.TrimSpace(string(out)); s != "" {
			uid = s
		}
	}
	if out, err := exec.Command("id", "-g", "vmail").Output(); err == nil {
		if s := strings.TrimSpace(string(out)); s != "" {
			gid = s
		}
	}
	_ = exec.Command("chown", "-R", uid+":"+gid, "/var/vmail").Run()
	return uid, gid
}

func mailTLSPair() (cert, key string) {
	pairs := [][2]string{
		{"/etc/akpanel/ssl/server/fullchain.pem", "/etc/akpanel/ssl/server/privkey.pem"},
		{"/etc/akpanel/ssl/default/fullchain.pem", "/etc/akpanel/ssl/default/privkey.pem"},
	}
	if ents, err := os.ReadDir("/etc/akpanel/ssl"); err == nil {
		for _, e := range ents {
			if !e.IsDir() {
				continue
			}
			name := e.Name()
			if name == "server" || name == "default" {
				continue
			}
			pairs = append(pairs, [2]string{
				"/etc/akpanel/ssl/" + name + "/fullchain.pem",
				"/etc/akpanel/ssl/" + name + "/privkey.pem",
			})
		}
	}
	pairs = append(pairs, [2]string{"/etc/ssl/certs/ssl-cert-snakeoil.pem", "/etc/ssl/private/ssl-cert-snakeoil.key"})
	for _, p := range pairs {
		if _, err := os.Stat(p[0]); err == nil {
			if _, err := os.Stat(p[1]); err == nil {
				return p[0], p[1]
			}
		}
	}
	return "/etc/akpanel/ssl/server/fullchain.pem", "/etc/akpanel/ssl/server/privkey.pem"
}

func (m *MailAuthService) writeDovecotListenersLocked() bool {
	cert, key := mailTLSPair()
	var b strings.Builder
	fmt.Fprintf(&b, `# AKpanel TLS + Postfix SASL (do not redeclare IMAP ports — Debian already binds 143/993)
ssl = yes
ssl_cert = <%s
ssl_key = <%s
disable_plaintext_auth = no
auth_mechanisms = plain login

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}
`, cert, key)
	for _, p := range mailTLSDomainPairs() {
		fmt.Fprintf(&b, `
local_name %s {
  ssl_cert = <%s
  ssl_key = <%s
}
local_name mail.%s {
  ssl_cert = <%s
  ssl_key = <%s
}
`, p.domain, p.cert, p.key, p.domain, p.cert, p.key)
	}
	return writeIfChanged("/etc/dovecot/conf.d/99-akpanel-listeners.conf", b.String(), 0644)
}

type mailCertPair struct {
	domain, cert, key string
}

func mailTLSDomainPairs() []mailCertPair {
	ents, err := os.ReadDir("/etc/akpanel/ssl")
	if err != nil {
		return nil
	}
	var out []mailCertPair
	for _, e := range ents {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		if name == "server" || name == "default" || !strings.Contains(name, ".") {
			continue
		}
		cert := "/etc/akpanel/ssl/" + name + "/fullchain.pem"
		key := "/etc/akpanel/ssl/" + name + "/privkey.pem"
		if _, err := os.Stat(cert); err != nil {
			continue
		}
		if _, err := os.Stat(key); err != nil {
			continue
		}
		out = append(out, mailCertPair{domain: name, cert: cert, key: key})
	}
	return out
}

func (m *MailAuthService) ensurePostfixMailStackLocked(uid, gid string) {
	cert, key := mailTLSPair()
	_ = exec.Command("postconf", "-e", "inet_interfaces = all").Run()
	_ = exec.Command("postconf", "-e", "smtpd_tls_cert_file = "+cert).Run()
	_ = exec.Command("postconf", "-e", "smtpd_tls_key_file = "+key).Run()
	_ = exec.Command("postconf", "-e", "smtpd_tls_security_level = may").Run()
	_ = exec.Command("postconf", "-e", "smtpd_sasl_type = dovecot").Run()
	_ = exec.Command("postconf", "-e", "smtpd_sasl_path = private/auth").Run()
	_ = exec.Command("postconf", "-e", "smtpd_sasl_auth_enable = yes").Run()
	_ = exec.Command("postconf", "-e", "smtpd_relay_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination").Run()
	_ = exec.Command("postconf", "-e", "virtual_mailbox_base = /var/vmail").Run()
	_ = exec.Command("postconf", "-e", "virtual_mailbox_domains = /etc/postfix/vmailbox_domains").Run()
	_ = exec.Command("postconf", "-e", "virtual_mailbox_maps = hash:/etc/postfix/vmailbox").Run()
	_ = exec.Command("postconf", "-e", "virtual_uid_maps = static:"+uid).Run()
	_ = exec.Command("postconf", "-e", "virtual_gid_maps = static:"+gid).Run()
	writePostfixSNIMap()
	ensurePostfixMasterServices()
	runTimeout(8*time.Second, "systemctl", "reload", "postfix")
}

func writePostfixSNIMap() {
	var lines []string
	for _, p := range mailTLSDomainPairs() {
		lines = append(lines,
			fmt.Sprintf("%s %s %s", p.domain, p.key, p.cert),
			fmt.Sprintf("mail.%s %s %s", p.domain, p.key, p.cert),
		)
	}
	path := "/etc/postfix/sni.map"
	_ = os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0644)
	_ = exec.Command("postmap", "-F", "hash:"+path).Run()
	if len(lines) > 0 {
		_ = exec.Command("postconf", "-e", "tls_server_sni_maps = hash:/etc/postfix/sni.map").Run()
	}
}

func ensurePostfixMasterServices() {
	master := "/etc/postfix/master.cf"
	b, err := os.ReadFile(master)
	if err != nil {
		return
	}
	s := string(b)
	needSub := !hasActiveMasterService(s, "submission")
	needSmtps := !hasActiveMasterService(s, "smtps")
	if !needSub && !needSmtps {
		return
	}
	block := "\n# AKpanel submission / SMTPS\n"
	if needSub {
		block += `submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=may
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=no
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,permit_mynetworks,reject
  -o smtpd_relay_restrictions=permit_sasl_authenticated,permit_mynetworks,reject
`
	}
	if needSmtps {
		block += `smtps     inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,permit_mynetworks,reject
  -o smtpd_relay_restrictions=permit_sasl_authenticated,permit_mynetworks,reject
`
	}
	_ = os.WriteFile(master, append(b, []byte(block)...), 0644)
}

func hasActiveMasterService(s, name string) bool {
	for _, line := range strings.Split(s, "\n") {
		t := strings.TrimSpace(line)
		if t == "" || strings.HasPrefix(t, "#") {
			continue
		}
		if strings.HasPrefix(t, name+" ") || t == name {
			return true
		}
	}
	return false
}

func (m *MailAuthService) hashPassword(password string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "openssl", "passwd", "-6", "-stdin")
	cmd.Stdin = strings.NewReader(password + "\n")
	if out, err := cmd.Output(); err == nil {
		h := strings.TrimSpace(string(out))
		if strings.HasPrefix(h, "$6$") {
			return "{SHA512-CRYPT}" + h, nil
		}
	}
	b, berr := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if berr != nil {
		h := sha512.Sum512([]byte(password))
		return fmt.Sprintf("{SHA512}%x", h), nil
	}
	return "{BLF-CRYPT}" + string(b), nil
}

func (m *MailAuthService) ensureMasterUserLocked() {
	secret := persistSecret("dovecot_master_pass", 24)
	hash, err := m.hashPassword(secret)
	if err != nil {
		return
	}
	_ = os.WriteFile("/etc/dovecot/akpanel-master-users", []byte("akpanel-sso:"+hash+"\n"), 0600)
}

// MasterLoginIdentity returns Roundcube IMAP login using the Dovecot master user.
func (m *MailAuthService) MasterLoginIdentity(email string) (user, pass string) {
	return email + "*akpanel-sso", persistSecret("dovecot_master_pass", 24)
}

// SetMailboxPassword adds or updates a mailbox password in Dovecot passwd-file.
func (m *MailAuthService) SetMailboxPassword(email, password string) error {
	hash, err := m.hashPassword(password)
	if err != nil {
		return err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	_ = os.MkdirAll("/etc/dovecot", 0755)

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
	uid, gid := ensureVmailIdentity()
	_ = exec.Command("postconf", "-e", "virtual_mailbox_domains=/etc/postfix/vmailbox_domains").Run()
	_ = exec.Command("postconf", "-e", "virtual_mailbox_maps=hash:/etc/postfix/vmailbox").Run()
	_ = exec.Command("postconf", "-e", "virtual_uid_maps=static:"+uid).Run()
	_ = exec.Command("postconf", "-e", "virtual_gid_maps=static:"+gid).Run()
	runTimeout(8*time.Second, "systemctl", "reload", "postfix")
	return nil
}
