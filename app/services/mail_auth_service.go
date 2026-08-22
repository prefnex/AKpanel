package services

import (
	"context"
	"crypto/sha512"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Dovecot reads one-time webmail SSO credentials from a dedicated passwd-file so
// Roundcube can log in with the plain mailbox address. Master-user logins ("user*master")
// cannot be used: Roundcube runs the username through idn_to_ascii(), which rejects "*"
// and turns the whole username into an empty string.
const (
	dovecotSSOPasswdFile = "/etc/dovecot/akpanel-sso-passwd"
	dovecotSSOIndexFile  = "/etc/dovecot/akpanel-sso-index.json"
	ssoPasswordTTL       = 3 * time.Minute
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
		_ = os.WriteFile(m.passwdFile, []byte(""), 0640)
	}
	if _, err := os.Stat(dovecotSSOPasswdFile); os.IsNotExist(err) {
		_ = os.WriteFile(dovecotSSOPasswdFile, []byte(""), 0640)
	}
	// os.WriteFile does not re-apply mode on an existing file, so chmod/chown
	// must run unconditionally — that repairs already-installed servers.
	secureDovecotFile(m.passwdFile)
	secureDovecotFile(dovecotSSOPasswdFile)

	authWorker := ""
	if dovecotGroupGID() < 0 {
		authWorker = `
service auth-worker {
  user = root
}
`
	}

	conf := fmt.Sprintf(`auth_master_user_separator = *

passdb {
  driver = passwd-file
  args = scheme=SHA512-CRYPT username_format=%%u /etc/dovecot/akpanel-master-users
  master = yes
}

# One-time webmail SSO credentials (pruned on every issue, entries expire in minutes).
passdb {
  driver = passwd-file
  args = scheme=SHA512-CRYPT username_format=%%u %s
}

passdb {
  driver = passwd-file
  args = scheme=SHA512-CRYPT username_format=%%u /etc/dovecot/akpanel-passwd
}
userdb {
  driver = static
  args = uid=%s gid=%s home=/var/vmail/%%d/%%n
}

# Postfix delivers Maildir into /var/vmail/<domain>/<user>/Maildir. Without this the
# Debian default (mbox in /var/mail/%%u) applies and IMAP shows an empty INBOX.
mail_location = maildir:~/Maildir
mail_privileged_group = vmail
%s`, dovecotSSOPasswdFile, uid, gid, authWorker)
	m.ensureMasterUserLocked()
	secureDovecotFile("/etc/dovecot/akpanel-master-users")
	m.pruneSSOPasswordsLocked()
	authChanged := writeIfChanged(m.confFile, conf, 0644)
	listenChanged := m.writeDovecotListenersLocked()
	m.ensurePostfixMailStackLocked(uid, gid)

	if authChanged || listenChanged {
		runTimeout(8*time.Second, "systemctl", "reload", "dovecot")
	}
	return nil
}

// secureDovecotFile makes a Dovecot passwd-file readable by the auth worker
// (euid=dovecot) without world-read: root:dovecot 0640.
func secureDovecotFile(path string) {
	if path == "" {
		return
	}
	_ = os.Chmod(path, 0640)
	if gid := dovecotGroupGID(); gid >= 0 {
		_ = os.Chown(path, 0, gid)
	}
}

func writeDovecotPasswdFile(path, body string) error {
	if err := os.WriteFile(path, []byte(body), 0640); err != nil {
		return err
	}
	secureDovecotFile(path)
	return nil
}

func dovecotGroupGID() int {
	g, err := user.LookupGroup("dovecot")
	if err != nil || g == nil {
		return -1
	}
	gid, err := strconv.Atoi(g.Gid)
	if err != nil {
		return -1
	}
	return gid
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
# Cleartext credentials are only tolerated from the loopback (Roundcube talks to
# 127.0.0.1:143); remote clients must negotiate STARTTLS or use the SSL ports.
disable_plaintext_auth = yes
auth_mechanisms = plain login

remote 127.0.0.1 {
  disable_plaintext_auth = no
}
remote ::1 {
  disable_plaintext_auth = no
}

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}

# Delivery goes through Dovecot LMTP instead of the Postfix virtual agent so Sieve
# scripts (autoresponders, filters) are actually executed on incoming mail.
service lmtp {
  unix_listener /var/spool/postfix/private/dovecot-lmtp {
    mode = 0600
    user = postfix
    group = postfix
  }
}

protocol lmtp {
  mail_plugins = $mail_plugins sieve
}
protocol lda {
  mail_plugins = $mail_plugins sieve
}

plugin {
  sieve = /var/vmail/%%d/%%n/.dovecot.sieve
  sieve_dir = /var/vmail/%%d/%%n/sieve
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
	// Without virtual_alias_maps Postfix ignores /etc/postfix/virtual entirely, so
	// forwarders and catch-alls written by the panel would never take effect.
	_ = exec.Command("postconf", "-e", "virtual_alias_maps = hash:/etc/postfix/virtual").Run()
	_ = exec.Command("postconf", "-e", "virtual_uid_maps = static:"+uid).Run()
	_ = exec.Command("postconf", "-e", "virtual_gid_maps = static:"+gid).Run()
	// Hand delivery to Dovecot LMTP so Sieve autoresponders and filters run.
	_ = exec.Command("postconf", "-e", "virtual_transport = lmtp:unix:private/dovecot-lmtp").Run()
	ensurePostfixVirtualAliasMapFile()
	writePostfixSNIMap()
	ensurePostfixMasterServices()
	runTimeout(8*time.Second, "systemctl", "reload", "postfix")
}

// ensurePostfixVirtualAliasMapFile guarantees /etc/postfix/virtual and its .db exist,
// otherwise Postfix refuses to start once virtual_alias_maps points at them.
func ensurePostfixVirtualAliasMapFile() {
	path := "/etc/postfix/virtual"
	if _, err := os.Stat(path); err != nil {
		_ = os.WriteFile(path, []byte("\n"), 0644)
	}
	if _, err := os.Stat(path + ".db"); err != nil {
		_ = exec.Command("postmap", path).Run()
	}
}

// EnsureMailIdentity pins the SMTP identity. A missing or bogus myhostname is one of the
// most common reasons remote MTAs reject or spam-folder outbound mail.
func (m *MailAuthService) EnsureMailIdentity() {
	host := strings.TrimSpace(NewDNSService().GetSystemHostname())
	if host == "" || !strings.Contains(host, ".") {
		return
	}
	domain := host
	if parts := strings.SplitN(host, ".", 2); len(parts) == 2 && strings.Contains(parts[1], ".") {
		domain = parts[1]
	}
	_ = exec.Command("postconf", "-e", "myhostname = "+host).Run()
	_ = exec.Command("postconf", "-e", "mydomain = "+domain).Run()
	_ = exec.Command("postconf", "-e", "myorigin = $myhostname").Run()
	_ = exec.Command("postconf", "-e", "smtp_helo_name = $myhostname").Run()
	_ = exec.Command("postconf", "-e", "smtpd_banner = $myhostname ESMTP").Run()
	runTimeout(10*time.Second, "systemctl", "reload", "postfix")
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
	_ = writeDovecotPasswdFile("/etc/dovecot/akpanel-master-users", "akpanel-sso:"+hash+"\n")
}

type ssoPasswordEntry struct {
	Hash      string `json:"hash"`
	ExpiresAt int64  `json:"expires_at"`
}

// IssueSSOPassword mints a short-lived password that authenticates only the given
// mailbox, so Roundcube can auto-login with the plain email address as username.
func (m *MailAuthService) IssueSSOPassword(email string) (string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" || !strings.Contains(email, "@") {
		return "", fmt.Errorf("invalid mailbox address")
	}
	password := randomAlnum(32)
	hash, err := m.hashPassword(password)
	if err != nil {
		return "", err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	index := m.readSSOIndexLocked()
	index[email] = ssoPasswordEntry{Hash: hash, ExpiresAt: time.Now().Add(ssoPasswordTTL).Unix()}
	if err := m.writeSSOIndexLocked(index); err != nil {
		return "", err
	}
	return password, nil
}

// RevokeSSOPassword drops any pending one-time credential for a mailbox.
func (m *MailAuthService) RevokeSSOPassword(email string) {
	email = strings.TrimSpace(strings.ToLower(email))
	m.mu.Lock()
	defer m.mu.Unlock()
	index := m.readSSOIndexLocked()
	if _, ok := index[email]; !ok {
		return
	}
	delete(index, email)
	_ = m.writeSSOIndexLocked(index)
}

func (m *MailAuthService) pruneSSOPasswordsLocked() {
	_ = m.writeSSOIndexLocked(m.readSSOIndexLocked())
}

func (m *MailAuthService) readSSOIndexLocked() map[string]ssoPasswordEntry {
	index := map[string]ssoPasswordEntry{}
	b, err := os.ReadFile(dovecotSSOIndexFile)
	if err != nil {
		return index
	}
	_ = json.Unmarshal(b, &index)
	now := time.Now().Unix()
	for email, entry := range index {
		if entry.ExpiresAt <= now || entry.Hash == "" {
			delete(index, email)
		}
	}
	return index
}

func (m *MailAuthService) writeSSOIndexLocked(index map[string]ssoPasswordEntry) error {
	body, err := json.Marshal(index)
	if err != nil {
		return err
	}
	if err := os.WriteFile(dovecotSSOIndexFile, body, 0600); err != nil {
		return err
	}
	lines := make([]string, 0, len(index))
	for email, entry := range index {
		lines = append(lines, fmt.Sprintf("%s:%s", email, entry.Hash))
	}
	sort.Strings(lines)
	return writeDovecotPasswdFile(dovecotSSOPasswdFile, strings.Join(lines, "\n")+"\n")
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
	return writeDovecotPasswdFile(m.passwdFile, strings.Join(out, "\n")+"\n")
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
	return writeDovecotPasswdFile(m.passwdFile, strings.Join(out, "\n")+"\n")
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
