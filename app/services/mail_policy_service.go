package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	antiSpamConfigPath = "/etc/akpanel/mail_antispam.json"
	mailRoutingPath    = "/etc/akpanel/mail_routing.json"

	opendkimMilter  = "inet:127.0.0.1:8891"
	spamassMilter   = "unix:/spamass/spamass.sock"
	postfixTransMap = "/etc/postfix/transport"
)

// AntiSpamSettings mirrors the SpamAssassin knobs exposed by the panel.
type AntiSpamSettings struct {
	Enabled        bool     `json:"enabled"`
	RequiredScore  float64  `json:"required_score"`
	RewriteSubject bool     `json:"rewrite_subject"`
	SubjectTag     string   `json:"subject_tag"`
	Blacklist      []string `json:"blacklist"`
	Whitelist      []string `json:"whitelist"`
	LastUpdate     string   `json:"last_update"`
}

// MailRoute describes where mail for a hosted domain should be delivered.
// mode: local (this server), backup (queue and relay), remote (forward to another MX).
type MailRoute struct {
	Domain      string `json:"domain"`
	Mode        string `json:"mode"`
	Destination string `json:"destination"`
	UpdatedAt   string `json:"updated_at"`
}

// MailPolicyService owns everything that has to be reflected into Postfix policy files:
// DKIM signing, SpamAssassin filtering and per-domain transport routing.
type MailPolicyService struct {
	mu sync.Mutex
}

var (
	mailPolicyOnce     sync.Once
	mailPolicyInstance *MailPolicyService
)

func NewMailPolicyService() *MailPolicyService {
	mailPolicyOnce.Do(func() {
		mailPolicyInstance = &MailPolicyService{}
	})
	return mailPolicyInstance
}

// ApplyAll re-applies DKIM, antispam and routing, then reloads Postfix once.
func (m *MailPolicyService) ApplyAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.applyDKIMLocked()
	m.applyAntiSpamLocked(m.readAntiSpamLocked())
	m.applyRoutingLocked(m.readRoutesLocked())
	m.applyMiltersLocked()
	runTimeout(10*time.Second, "systemctl", "reload", "postfix")
}

// ---------------------------------------------------------------- anti-spam

func (m *MailPolicyService) GetAntiSpam() AntiSpamSettings {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.readAntiSpamLocked()
}

func (m *MailPolicyService) SaveAntiSpam(s AntiSpamSettings) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if s.RequiredScore <= 0 {
		s.RequiredScore = 5
	}
	if s.RequiredScore > 20 {
		s.RequiredScore = 20
	}
	if strings.TrimSpace(s.SubjectTag) == "" {
		s.SubjectTag = "[SPAM]"
	}
	s.Blacklist = normalizeAddressList(s.Blacklist)
	s.Whitelist = normalizeAddressList(s.Whitelist)

	body, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(antiSpamConfigPath, body, 0644); err != nil {
		return err
	}
	m.applyAntiSpamLocked(s)
	m.applyMiltersLocked()
	runTimeout(10*time.Second, "systemctl", "reload", "postfix")
	return nil
}

// UpdateSpamRules refreshes the SpamAssassin rule set (sa-update) and recompiles.
func (m *MailPolicyService) UpdateSpamRules() error {
	ctxErr := exec.Command("sa-update").Run()
	// sa-update exits 1 when there is simply nothing new; that is not a failure.
	if ctxErr != nil {
		if ee, ok := ctxErr.(*exec.ExitError); !ok || ee.ExitCode() != 1 {
			return fmt.Errorf("sa-update failed: %w", ctxErr)
		}
	}
	runTimeout(60*time.Second, "systemctl", "restart", spamdUnit())

	m.mu.Lock()
	defer m.mu.Unlock()
	s := m.readAntiSpamLocked()
	s.LastUpdate = time.Now().UTC().Format(time.RFC3339)
	if body, err := json.MarshalIndent(s, "", "  "); err == nil {
		_ = os.WriteFile(antiSpamConfigPath, body, 0644)
	}
	return nil
}

// spamdUnit resolves the SpamAssassin unit name. Debian 12 ships spamd.service and only
// exposes spamassassin.service as an alias, which systemctl enable refuses to take.
func spamdUnit() string {
	if err := exec.Command("systemctl", "cat", "spamd.service").Run(); err == nil {
		return "spamd"
	}
	return "spamassassin"
}

func (m *MailPolicyService) readAntiSpamLocked() AntiSpamSettings {
	s := AntiSpamSettings{Enabled: true, RequiredScore: 5, RewriteSubject: true, SubjectTag: "[SPAM]"}
	b, err := os.ReadFile(antiSpamConfigPath)
	if err != nil {
		return s
	}
	_ = json.Unmarshal(b, &s)
	if s.RequiredScore <= 0 {
		s.RequiredScore = 5
	}
	if strings.TrimSpace(s.SubjectTag) == "" {
		s.SubjectTag = "[SPAM]"
	}
	return s
}

func (m *MailPolicyService) applyAntiSpamLocked(s AntiSpamSettings) {
	var b strings.Builder
	b.WriteString("# Managed by AKpanel — edits are overwritten.\n")
	fmt.Fprintf(&b, "required_score %.1f\n", s.RequiredScore)
	b.WriteString("report_safe 0\n")
	if s.RewriteSubject {
		b.WriteString("rewrite_header Subject " + s.SubjectTag + " _SCORE_\n")
	}
	for _, addr := range s.Blacklist {
		fmt.Fprintf(&b, "blacklist_from %s\n", addr)
	}
	for _, addr := range s.Whitelist {
		fmt.Fprintf(&b, "whitelist_from %s\n", addr)
	}
	_ = os.MkdirAll("/etc/spamassassin", 0755)
	changed := writeIfChanged("/etc/spamassassin/akpanel.cf", b.String(), 0644)

	if !s.Enabled {
		runTimeout(15*time.Second, "systemctl", "stop", "spamass-milter")
		runTimeout(15*time.Second, "systemctl", "disable", "spamass-milter")
		return
	}

	// Debian's spamass-milter listens on a socket inside the Postfix chroot so the
	// smtpd milter path stays valid.
	_ = os.MkdirAll("/var/spool/postfix/spamass", 0755)
	_ = exec.Command("chown", "spamass-milter:postfix", "/var/spool/postfix/spamass").Run()
	defaults := `# Managed by AKpanel
OPTIONS="-u spamass-milter -i 127.0.0.1 -m -r -1"
SOCKET="/var/spool/postfix/spamass/spamass.sock"
SOCKETOWNER="postfix:postfix"
SOCKETMODE="0660"
`
	defaultsChanged := writeIfChanged("/etc/default/spamass-milter", defaults, 0644)

	spamd := spamdUnit()
	runTimeout(20*time.Second, "systemctl", "enable", spamd)
	runTimeout(30*time.Second, "systemctl", "restart", spamd)
	runTimeout(20*time.Second, "systemctl", "enable", "spamass-milter")
	if changed || defaultsChanged {
		runTimeout(30*time.Second, "systemctl", "restart", "spamass-milter")
	} else {
		runTimeout(30*time.Second, "systemctl", "start", "spamass-milter")
	}
}

// ---------------------------------------------------------------- DKIM

func (m *MailPolicyService) applyDKIMLocked() {
	keysRoot := "/etc/opendkim/keys"
	entries, err := os.ReadDir(keysRoot)
	if err != nil {
		return
	}

	var keyTable, signingTable []string
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		domain := e.Name()
		if !strings.Contains(domain, ".") {
			continue
		}
		key := filepath.Join(keysRoot, domain, "default.private")
		if _, err := os.Stat(key); err != nil {
			continue
		}
		_ = exec.Command("chown", "opendkim:opendkim", key).Run()
		_ = os.Chmod(key, 0600)
		keyTable = append(keyTable, fmt.Sprintf("default._domainkey.%s %s:default:%s", domain, domain, key))
		signingTable = append(signingTable, fmt.Sprintf("*@%s default._domainkey.%s", domain, domain))
	}
	sort.Strings(keyTable)
	sort.Strings(signingTable)

	_ = os.MkdirAll("/etc/opendkim", 0755)
	trusted := "127.0.0.1\nlocalhost\n::1\n"
	if ip := strings.TrimSpace(NewDNSService().GetSystemIP()); ip != "" {
		trusted += ip + "\n"
	}
	_ = os.WriteFile("/etc/opendkim/TrustedHosts", []byte(trusted), 0644)
	_ = os.WriteFile("/etc/opendkim/KeyTable", []byte(strings.Join(keyTable, "\n")+"\n"), 0644)
	_ = os.WriteFile("/etc/opendkim/SigningTable", []byte(strings.Join(signingTable, "\n")+"\n"), 0644)
	_ = exec.Command("chown", "-R", "opendkim:opendkim", "/etc/opendkim").Run()

	// An inet socket avoids the Postfix chroot pitfalls of a unix socket path.
	conf := `# Managed by AKpanel — edits are overwritten.
Syslog                  yes
SyslogSuccess           yes
UMask                   007
Mode                    sv
Canonicalization        relaxed/simple
Socket                  inet:8891@127.0.0.1
PidFile                 /run/opendkim/opendkim.pid
UserID                  opendkim
OversignHeaders         From
SubDomains              no
AutoRestart             yes
AutoRestartRate         10/1h
KeyTable                /etc/opendkim/KeyTable
SigningTable            refile:/etc/opendkim/SigningTable
ExternalIgnoreList      refile:/etc/opendkim/TrustedHosts
InternalHosts           refile:/etc/opendkim/TrustedHosts
`
	changed := writeIfChanged("/etc/opendkim.conf", conf, 0644)
	_ = os.WriteFile("/etc/default/opendkim", []byte("# Managed by AKpanel\nSOCKET=\"inet:8891@127.0.0.1\"\n"), 0644)

	if len(keyTable) == 0 {
		return
	}
	runTimeout(20*time.Second, "systemctl", "enable", "opendkim")
	if changed {
		runTimeout(30*time.Second, "systemctl", "restart", "opendkim")
	} else {
		runTimeout(30*time.Second, "systemctl", "start", "opendkim")
	}
}

// DKIMSigningActive reports whether OpenDKIM has at least one key wired into Postfix.
func (m *MailPolicyService) DKIMSigningActive(domain string) bool {
	b, err := os.ReadFile("/etc/opendkim/SigningTable")
	if err != nil {
		return false
	}
	if !strings.Contains(string(b), "@"+strings.ToLower(domain)+" ") {
		return false
	}
	out, err := exec.Command("postconf", "-h", "smtpd_milters").Output()
	if err != nil {
		return false
	}
	return strings.Contains(string(out), "8891")
}

// ---------------------------------------------------------------- milters

func (m *MailPolicyService) applyMiltersLocked() {
	var milters []string
	if _, err := os.Stat("/etc/opendkim/KeyTable"); err == nil {
		if b, err := os.ReadFile("/etc/opendkim/KeyTable"); err == nil && strings.TrimSpace(string(b)) != "" {
			milters = append(milters, opendkimMilter)
		}
	}
	if m.readAntiSpamLocked().Enabled {
		milters = append(milters, spamassMilter)
	}

	joined := strings.Join(milters, ", ")
	_ = exec.Command("postconf", "-e", "smtpd_milters = "+joined).Run()
	_ = exec.Command("postconf", "-e", "non_smtpd_milters = "+joined).Run()
	_ = exec.Command("postconf", "-e", "milter_default_action = accept").Run()
	_ = exec.Command("postconf", "-e", "milter_protocol = 6").Run()
}

// ---------------------------------------------------------------- routing

func (m *MailPolicyService) ListRoutes() []MailRoute {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.readRoutesLocked()
}

func (m *MailPolicyService) SaveRoute(route MailRoute) error {
	route.Domain = strings.TrimSpace(strings.ToLower(route.Domain))
	route.Mode = strings.TrimSpace(strings.ToLower(route.Mode))
	route.Destination = strings.TrimSpace(route.Destination)

	if route.Domain == "" || !strings.Contains(route.Domain, ".") {
		return fmt.Errorf("a valid domain is required")
	}
	switch route.Mode {
	case "local":
		route.Destination = ""
	case "backup", "remote":
		if route.Destination == "" {
			return fmt.Errorf("%s routing requires a destination mail server", route.Mode)
		}
	default:
		return fmt.Errorf("mode must be local, backup or remote")
	}
	route.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	m.mu.Lock()
	defer m.mu.Unlock()

	routes := m.readRoutesLocked()
	replaced := false
	for i := range routes {
		if routes[i].Domain == route.Domain {
			routes[i] = route
			replaced = true
			break
		}
	}
	if !replaced {
		routes = append(routes, route)
	}
	if err := m.writeRoutesLocked(routes); err != nil {
		return err
	}
	m.applyRoutingLocked(routes)
	runTimeout(10*time.Second, "systemctl", "reload", "postfix")
	return nil
}

func (m *MailPolicyService) DeleteRoute(domain string) error {
	domain = strings.TrimSpace(strings.ToLower(domain))

	m.mu.Lock()
	defer m.mu.Unlock()

	routes := m.readRoutesLocked()
	kept := make([]MailRoute, 0, len(routes))
	for _, r := range routes {
		if r.Domain != domain {
			kept = append(kept, r)
		}
	}
	if err := m.writeRoutesLocked(kept); err != nil {
		return err
	}
	m.applyRoutingLocked(kept)
	runTimeout(10*time.Second, "systemctl", "reload", "postfix")
	return nil
}

func (m *MailPolicyService) readRoutesLocked() []MailRoute {
	routes := []MailRoute{}
	b, err := os.ReadFile(mailRoutingPath)
	if err != nil {
		return routes
	}
	_ = json.Unmarshal(b, &routes)
	return routes
}

func (m *MailPolicyService) writeRoutesLocked(routes []MailRoute) error {
	body, err := json.MarshalIndent(routes, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(mailRoutingPath, body, 0644)
}

func (m *MailPolicyService) applyRoutingLocked(routes []MailRoute) {
	var lines []string
	var relayDomains []string
	for _, r := range routes {
		switch r.Mode {
		case "backup":
			lines = append(lines, fmt.Sprintf("%s relay:[%s]", r.Domain, r.Destination))
			relayDomains = append(relayDomains, r.Domain)
		case "remote":
			lines = append(lines, fmt.Sprintf("%s smtp:[%s]", r.Domain, r.Destination))
			relayDomains = append(relayDomains, r.Domain)
		default:
			lines = append(lines, fmt.Sprintf("%s virtual:", r.Domain))
		}
	}
	sort.Strings(lines)

	_ = os.WriteFile(postfixTransMap, []byte(strings.Join(lines, "\n")+"\n"), 0644)
	_ = exec.Command("postmap", postfixTransMap).Run()
	_ = exec.Command("postconf", "-e", "transport_maps = hash:"+postfixTransMap).Run()
	_ = exec.Command("postconf", "-e", "relay_domains = "+strings.Join(relayDomains, ", ")).Run()
}

func normalizeAddressList(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, raw := range in {
		v := strings.TrimSpace(strings.ToLower(raw))
		if v == "" || seen[v] {
			continue
		}
		// SpamAssassin address globs allow letters, digits, dots, dashes, @ and *.
		if strings.ContainsAny(v, " \t\n\r:;") {
			continue
		}
		seen[v] = true
		out = append(out, v)
	}
	sort.Strings(out)
	return out
}
