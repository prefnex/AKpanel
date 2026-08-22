package services

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"goravel/app/paths"
)

type EmailAccount struct {
	Email      string `json:"email"`
	Domain     string `json:"domain"`
	Username   string `json:"username"`
	QuotaMB    int    `json:"quota_mb"` // 0 = Unlimited
	UsedMB     int    `json:"used_mb"`
	Status     string `json:"status"` // active, suspended
	WebmailURL string `json:"webmail_url"`
	CreatedAt  string `json:"created_at"`
}

type EmailAlias struct {
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Domain      string `json:"domain"`
	CreatedAt   string `json:"created_at"`
}

type MailQueueItem struct {
	QueueID   string `json:"queue_id"`
	Sender    string `json:"sender"`
	Recipient string `json:"recipient"`
	Size      string `json:"size"`
	Arrival   string `json:"arrival"`
	Status    string `json:"status"`
}

type SecurityHealthReport struct {
	Domain             string `json:"domain"`
	DeliverabilityRate int    `json:"deliverability_rate"` // e.g. 100%
	SPFValid           bool   `json:"spf_valid"`
	SPFRecord          string `json:"spf_record"`
	DKIMValid          bool   `json:"dkim_valid"`
	DKIMRecord         string `json:"dkim_record"`
	DMARCValid         bool   `json:"dmarc_valid"`
	DMARCRecord        string `json:"dmarc_record"`
	MXValid            bool   `json:"mx_valid"`
	MXRecord           string `json:"mx_record"`
	PTRValid           bool   `json:"ptr_valid"`
	PTRRecord          string `json:"ptr_record"`
	CAAValid           bool   `json:"caa_valid"`
	CAARecord          string `json:"caa_record"`
}

type MailServerConfig struct {
	SMTPPort            int    `json:"smtp_port"`
	SMTPSubmissionPort  int    `json:"smtp_submission_port"`
	SMTPSSPort          int    `json:"smtp_ss_port"`
	IMAPPort            int    `json:"imap_port"`
	IMAPSSPort          int    `json:"imap_ss_port"`
	POP3Port            int    `json:"pop3_port"`
	POP3SSPort          int    `json:"pop3_ss_port"`
	MaxAttachmentMB     int    `json:"max_attachment_mb"`
	MaxMessageMB        int    `json:"max_message_mb"`
	RelayHost           string `json:"relay_host"`
	RelayUser           string `json:"relay_user"`
	RelayPass           string `json:"relay_pass"`
	RelayEnabled        bool   `json:"relay_enabled"`
	CatchAllEmail       string `json:"catch_all_email"`
	SpamAssassinEnabled bool   `json:"spamassassin_enabled"`
	GreylistingEnabled  bool   `json:"greylisting_enabled"`
	TLSRequireSSL       bool   `json:"tls_require_ssl"`
	WebmailEnabled      bool   `json:"webmail_enabled"`
	WebmailPath         string `json:"webmail_path"`
}

type MailServiceStatus struct {
	PostfixRunning      bool   `json:"postfix_running"`
	DovecotRunning      bool   `json:"dovecot_running"`
	OpenDKIMRunning     bool   `json:"opendkim_running"`
	SpamAssassinRunning bool   `json:"spamassassin_running"`
	ServerIP            string `json:"server_ip"`
	Hostname            string `json:"hostname"`
}

type EmailService struct {
	mu          sync.RWMutex
	filePath    string
	aliasesPath string
	configPath  string
	dnsService  *DNSService
}

var (
	emailServiceInstance *EmailService
	emailOnce            sync.Once
	ErrMailboxExists     = errors.New("mailbox already exists")
)

func NewEmailService() *EmailService {
	emailOnce.Do(func() {
		_ = os.MkdirAll("/etc/akpanel", 0755)
		_ = os.MkdirAll("/var/vmail", 0755)
		_ = os.MkdirAll("/etc/postfix", 0755)
		_ = os.MkdirAll("/etc/dovecot", 0755)
		s := &EmailService{
			filePath:    "/etc/akpanel/emails.json",
			aliasesPath: "/etc/akpanel/email_aliases.json",
			configPath:  "/etc/akpanel/mail_server.json",
			dnsService:  NewDNSService(),
		}
		s.initDefaultConfig()
		s.initDefaultEmails()
		s.initDefaultAliases()
		emailServiceInstance = s
		go func() {
			defer func() { _ = recover() }()
			s.EnsureRoundcubeWebmail()
			_ = GetMailAuthService().EnsureDovecotConfig()
		}()
	})
	return emailServiceInstance
}

func (s *EmailService) initDefaultConfig() {
	if _, err := os.Stat(s.configPath); os.IsNotExist(err) {
		cfg := MailServerConfig{
			SMTPPort:            25,
			SMTPSubmissionPort:  587,
			SMTPSSPort:          465,
			IMAPPort:            143,
			IMAPSSPort:          993,
			POP3Port:            110,
			POP3SSPort:          995,
			MaxAttachmentMB:     50,
			MaxMessageMB:        100,
			RelayEnabled:        false,
			SpamAssassinEnabled: true,
			GreylistingEnabled:  false,
			TLSRequireSSL:       true,
			WebmailEnabled:      true,
			WebmailPath:         "/webmail",
		}
		bytes, _ := json.MarshalIndent(cfg, "", "  ")
		_ = os.WriteFile(s.configPath, bytes, 0644)
	}
}

func (s *EmailService) GetConfig() MailServerConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var cfg MailServerConfig
	content, err := os.ReadFile(s.configPath)
	if err != nil {
		return MailServerConfig{
			SMTPPort:        25,
			IMAPPort:        143,
			POP3Port:        110,
			MaxAttachmentMB: 50,
			MaxMessageMB:    100,
			WebmailEnabled:  true,
		}
	}
	_ = json.Unmarshal(content, &cfg)
	return cfg
}

func (s *EmailService) SaveConfig(cfg MailServerConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if cfg.SMTPPort <= 0 {
		cfg.SMTPPort = 25
	}
	if cfg.MaxAttachmentMB <= 0 {
		cfg.MaxAttachmentMB = 50
	}
	if cfg.MaxMessageMB <= 0 {
		cfg.MaxMessageMB = 100
	}

	bytes, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	if err := os.WriteFile(s.configPath, bytes, 0644); err != nil {
		return err
	}

	// Apply configuration to Postfix main.cf if present
	s.applyPostfixConfig(cfg)
	return nil
}

func (s *EmailService) applyPostfixConfig(cfg MailServerConfig) {
	mainCfPath := "/etc/postfix/main.cf"
	if _, err := os.Stat(mainCfPath); err == nil {
		maxBytes := cfg.MaxMessageMB * 1024 * 1024
		_ = exec.Command("postconf", "-e", fmt.Sprintf("message_size_limit = %d", maxBytes)).Run()
		if cfg.RelayEnabled && cfg.RelayHost != "" {
			_ = exec.Command("postconf", "-e", fmt.Sprintf("relayhost = [%s]", cfg.RelayHost)).Run()
		} else {
			_ = exec.Command("postconf", "-e", "relayhost = ").Run()
		}
		_ = exec.Command("service", "postfix", "reload").Run()
	}
}

func (s *EmailService) GetServiceStatus() MailServiceStatus {
	isPostfix := s.checkServiceRunning("postfix")
	isDovecot := s.checkServiceRunning("dovecot")
	isOpenDKIM := s.checkServiceRunning("opendkim")
	isSpam := s.checkServiceRunning(spamdUnit())

	return MailServiceStatus{
		PostfixRunning:      isPostfix,
		DovecotRunning:      isDovecot,
		OpenDKIMRunning:     isOpenDKIM,
		SpamAssassinRunning: isSpam,
		ServerIP:            s.dnsService.GetSystemIP(),
		Hostname:            s.dnsService.GetSystemHostname(),
	}
}

// checkServiceRunning asks systemd directly. Parsing `service X status` for the word
// "active" is unreliable because "Active: inactive (dead)" also contains it.
func (s *EmailService) checkServiceRunning(name string) bool {
	out, err := exec.Command("systemctl", "is-active", name).Output()
	if err == nil && strings.TrimSpace(string(out)) == "active" {
		return true
	}
	return exec.Command("pgrep", "-x", name).Run() == nil
}

func (s *EmailService) ControlService(serviceName, action string) error {
	validServices := map[string]bool{
		"postfix":      true,
		"dovecot":      true,
		"opendkim":     true,
		"spamassassin": true,
	}
	if !validServices[serviceName] {
		return fmt.Errorf("invalid mail service: %s", serviceName)
	}

	validActions := map[string]bool{
		"start":   true,
		"stop":    true,
		"restart": true,
		"reload":  true,
	}
	if !validActions[action] {
		return fmt.Errorf("invalid action: %s", action)
	}

	unit := serviceName
	if serviceName == "spamassassin" {
		unit = spamdUnit()
	}
	return exec.Command("systemctl", action, unit).Run()
}

func (s *EmailService) initDefaultAliases() {
	if _, err := os.Stat(s.aliasesPath); os.IsNotExist(err) {
		defaults := []EmailAlias{}
		bytes, _ := json.MarshalIndent(defaults, "", "  ")
		_ = os.WriteFile(s.aliasesPath, bytes, 0644)
	}
}

func (s *EmailService) ListAliases(domain string) []EmailAlias {
	s.mu.RLock()
	defer s.mu.RUnlock()

	content, err := os.ReadFile(s.aliasesPath)
	if err != nil {
		return []EmailAlias{}
	}
	var list []EmailAlias
	_ = json.Unmarshal(content, &list)

	if domain == "" || domain == "all" {
		return list
	}

	var filtered []EmailAlias
	for _, a := range list {
		if strings.EqualFold(a.Domain, domain) {
			filtered = append(filtered, a)
		}
	}
	return filtered
}

func (s *EmailService) CreateAlias(source, destination string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	source = strings.TrimSpace(strings.ToLower(source))
	destination = strings.TrimSpace(strings.ToLower(destination))

	// A source of "@domain" is a domain-wide catch-all in Postfix virtual maps.
	parts := strings.Split(source, "@")
	if len(parts) != 2 || parts[1] == "" {
		return fmt.Errorf("invalid source address: use user@domain or @domain for a catch-all")
	}
	if !strings.Contains(destination, "@") {
		return fmt.Errorf("invalid destination email address")
	}
	domain := parts[1]

	var list []EmailAlias
	if content, err := os.ReadFile(s.aliasesPath); err == nil {
		_ = json.Unmarshal(content, &list)
	}

	for _, a := range list {
		if a.Source == source && a.Destination == destination {
			return fmt.Errorf("alias forwarder already exists")
		}
	}

	list = append(list, EmailAlias{
		Source:      source,
		Destination: destination,
		Domain:      domain,
		CreatedAt:   time.Now().Format("2006-01-02"),
	})

	bytes, _ := json.MarshalIndent(list, "", "  ")
	_ = os.WriteFile(s.aliasesPath, bytes, 0644)

	s.syncPostfixVirtualAliases()
	return nil
}

func (s *EmailService) DeleteAlias(source, destination string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var list []EmailAlias
	if content, err := os.ReadFile(s.aliasesPath); err == nil {
		_ = json.Unmarshal(content, &list)
	}

	var updated []EmailAlias
	for _, a := range list {
		if a.Source == source && a.Destination == destination {
			continue
		}
		updated = append(updated, a)
	}

	bytes, _ := json.MarshalIndent(updated, "", "  ")
	_ = os.WriteFile(s.aliasesPath, bytes, 0644)

	s.syncPostfixVirtualAliases()
	return nil
}

func (s *EmailService) syncPostfixVirtualAliases() {
	var list []EmailAlias
	if content, err := os.ReadFile(s.aliasesPath); err == nil {
		_ = json.Unmarshal(content, &list)
	}

	// Multiple destinations for the same source must land on one line, otherwise the
	// hash map keeps only the last entry.
	targets := map[string][]string{}
	var order []string
	for _, a := range list {
		if a.Source == "" || a.Destination == "" {
			continue
		}
		if _, ok := targets[a.Source]; !ok {
			order = append(order, a.Source)
		}
		targets[a.Source] = append(targets[a.Source], a.Destination)
	}
	sort.Strings(order)

	lines := make([]string, 0, len(order))
	for _, src := range order {
		lines = append(lines, fmt.Sprintf("%s %s", src, strings.Join(targets[src], ", ")))
	}

	virtualPath := "/etc/postfix/virtual"
	_ = os.WriteFile(virtualPath, []byte(strings.Join(lines, "\n")+"\n"), 0644)
	_ = exec.Command("postmap", virtualPath).Run()
	_ = exec.Command("postconf", "-e", "virtual_alias_maps = hash:"+virtualPath).Run()
	runTimeout(10*time.Second, "systemctl", "reload", "postfix")
}

func (s *EmailService) initDefaultEmails() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		defaults := []EmailAccount{}
		bytes, _ := json.MarshalIndent(defaults, "", "  ")
		_ = os.WriteFile(s.filePath, bytes, 0644)
	}
}

func (s *EmailService) readEmails() ([]EmailAccount, error) {
	content, err := os.ReadFile(s.filePath)
	if err != nil {
		return nil, err
	}
	var list []EmailAccount
	if err := json.Unmarshal(content, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (s *EmailService) writeEmails(list []EmailAccount) error {
	bytes, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, bytes, 0644)
}

// AccountExists reports whether a mailbox is registered, without touching the disk usage
// refresh that ListAccounts performs.
func (s *EmailService) AccountExists(email string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	email = strings.TrimSpace(strings.ToLower(email))
	list, err := s.readEmails()
	if err != nil {
		return false
	}
	for _, e := range list {
		if e.Email == email {
			return true
		}
	}
	return false
}

// ListAccounts returns all email accounts
func (s *EmailService) ListAccounts(domain string) []EmailAccount {
	// Takes the write lock because the disk-usage refresh below rewrites emails.json.
	s.mu.Lock()
	defer s.mu.Unlock()

	list, err := s.readEmails()
	if err != nil {
		return []EmailAccount{}
	}

	for i := range list {
		e := &list[i]
		mailDir := fmt.Sprintf("/var/vmail/%s/%s", e.Domain, e.Username)
		if _, err := os.Stat(mailDir); err == nil {
			cmd := exec.Command("bash", "-c", fmt.Sprintf("du -sm %s 2>/dev/null | awk '{print $1}'", mailDir))
			if out, err := cmd.Output(); err == nil {
				if mb, err := strconv.Atoi(strings.TrimSpace(string(out))); err == nil {
					e.UsedMB = mb
				}
			}
		}
	}

	_ = s.writeEmails(list)

	if domain == "" || domain == "all" {
		return list
	}

	var filtered []EmailAccount
	for _, e := range list {
		if strings.EqualFold(e.Domain, domain) {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

// CreateAccount provisions virtual mailbox for Postfix/Dovecot
func (s *EmailService) CreateAccount(email, password string, quotaMB int) error {
	s.mu.Lock()

	email = strings.TrimSpace(strings.ToLower(email))
	parts := strings.Split(email, "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		s.mu.Unlock()
		return fmt.Errorf("invalid email address format: %s", email)
	}

	username := parts[0]
	domain := parts[1]

	list, err := s.readEmails()
	if err != nil {
		s.mu.Unlock()
		return err
	}
	for _, e := range list {
		if e.Email == email {
			s.mu.Unlock()
			return ErrMailboxExists
		}
	}

	mailDir := fmt.Sprintf("/var/vmail/%s/%s/Maildir", domain, username)
	_ = os.MkdirAll(fmt.Sprintf("%s/cur", mailDir), 0700)
	_ = os.MkdirAll(fmt.Sprintf("%s/new", mailDir), 0700)
	_ = os.MkdirAll(fmt.Sprintf("%s/tmp", mailDir), 0700)

	if quotaMB < 0 {
		quotaMB = 0
	}

	newAcc := EmailAccount{
		Email:      email,
		Domain:     domain,
		Username:   username,
		QuotaMB:    quotaMB,
		UsedMB:     1,
		Status:     "active",
		WebmailURL: "/webmail",
		CreatedAt:  time.Now().Format("2006-01-02"),
	}

	list = append(list, newAcc)
	if err := s.writeEmails(list); err != nil {
		s.mu.Unlock()
		return err
	}

	if err := GetMailAuthService().SetMailboxPassword(email, password); err != nil {
		s.mu.Unlock()
		return err
	}

	s.syncPostfixMailboxMaps(list)
	s.mu.Unlock()

	go func() {
		defer func() { _ = recover() }()
		_ = GetMailAuthService().EnsureDovecotConfig()
		_, _ = s.dnsService.CreateZone(domain, s.dnsService.GetSystemIP(), "root", "")
		_ = exec.Command("chown", "-R", "vmail:vmail", fmt.Sprintf("/var/vmail/%s", domain)).Run()
		_ = GetMailAuthService().EnsurePostfixVirtualConfig()
	}()

	return nil
}

// syncPostfixMailboxMaps rebuilds the Postfix delivery maps from emails.json. Rebuilding
// instead of appending keeps deletions and retried creates from leaving stale entries
// that would let Postfix keep accepting mail for removed mailboxes.
func (s *EmailService) syncPostfixMailboxMaps(list []EmailAccount) {
	mailboxes := make([]string, 0, len(list))
	domains := make([]string, 0, len(list))
	seenDomain := map[string]bool{}

	for _, e := range list {
		if e.Email == "" || e.Domain == "" || e.Username == "" {
			continue
		}
		mailboxes = append(mailboxes, fmt.Sprintf("%s %s/%s/Maildir/", e.Email, e.Domain, e.Username))
		if !seenDomain[e.Domain] {
			seenDomain[e.Domain] = true
			domains = append(domains, e.Domain)
		}
	}
	sort.Strings(mailboxes)
	sort.Strings(domains)

	vmailFile := "/etc/postfix/vmailbox"
	_ = os.WriteFile(vmailFile, []byte(strings.Join(mailboxes, "\n")+"\n"), 0644)
	_ = exec.Command("postmap", vmailFile).Run()
	_ = os.WriteFile("/etc/postfix/vmailbox_domains", []byte(strings.Join(domains, "\n")+"\n"), 0644)
}

// ChangePassword updates mailbox password
func (s *EmailService) ChangePassword(email, newPassword string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(newPassword) < 6 {
		return fmt.Errorf("password must be at least 6 characters")
	}

	list, _ := s.readEmails()
	found := false
	for _, e := range list {
		if e.Email == email {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("email account not found")
	}

	return GetMailAuthService().SetMailboxPassword(email, newPassword)
}

// DeleteAccount removes virtual mailbox
func (s *EmailService) DeleteAccount(email string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	list, _ := s.readEmails()
	var updated []EmailAccount
	var mailDir string

	for _, e := range list {
		if e.Email == email {
			mailDir = fmt.Sprintf("/var/vmail/%s/%s", e.Domain, e.Username)
		} else {
			updated = append(updated, e)
		}
	}

	if mailDir == "" {
		return fmt.Errorf("email account not found")
	}

	_ = os.RemoveAll(mailDir)
	_ = GetMailAuthService().RemoveMailboxPassword(email)
	GetMailAuthService().RevokeSSOPassword(email)

	if err := s.writeEmails(updated); err != nil {
		return err
	}
	s.syncPostfixMailboxMaps(updated)
	_ = GetMailAuthService().EnsurePostfixVirtualConfig()
	// The Sieve script died with the mailbox directory; drop the panel record too so the
	// autoresponders tab does not list a mailbox that no longer exists.
	_ = NewMailSieveService().Delete(email)
	return nil
}

// GetMailQueue lists Postfix mail queue
func (s *EmailService) GetMailQueue() ([]MailQueueItem, error) {
	cmd := exec.Command("bash", "-c", "mailq 2>/dev/null | grep -E '^[0-9A-F]+' | head -n 25")
	out, err := cmd.Output()
	if err != nil || len(out) == 0 {
		return []MailQueueItem{}, nil
	}

	var queue []MailQueueItem
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) >= 4 {
			queue = append(queue, MailQueueItem{
				QueueID:   fields[0],
				Size:      fields[1],
				Arrival:   fields[2] + " " + fields[3],
				Sender:    "mailer-daemon",
				Recipient: "client-delivery",
				Status:    "Queued in Postfix spool",
			})
		}
	}
	return queue, nil
}

// FlushMailQueue executes postfix flush
func (s *EmailService) FlushMailQueue() error {
	cmd := exec.Command("postfix", "flush")
	return cmd.Run()
}

// DeleteQueueItem deletes a specific message from queue
func (s *EmailService) DeleteQueueItem(queueID string) error {
	queueID = strings.TrimSpace(queueID)
	if queueID == "" {
		return fmt.Errorf("queue_id is required")
	}
	if queueID == "ALL" {
		return exec.Command("postsuper", "-d", "ALL").Run()
	}
	return exec.Command("postsuper", "-d", queueID).Run()
}

// VerifySecurityHealth resolves the live SPF, DKIM, DMARC, MX, PTR and CAA records for a
// domain. Everything here is measured, never assumed: a wrong report is worse than none,
// because it hides the exact misconfiguration that sends mail to spam.
func (s *EmailService) VerifySecurityHealth(domain string) SecurityHealthReport {
	domain = strings.TrimSpace(strings.ToLower(domain))
	report := SecurityHealthReport{Domain: domain}
	if domain == "" {
		return report
	}

	resolver := &net.Resolver{}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	checks := 0
	passed := 0

	// SPF
	checks++
	if txts, err := resolver.LookupTXT(ctx, domain); err == nil {
		for _, txt := range txts {
			if strings.HasPrefix(strings.ToLower(txt), "v=spf1") {
				report.SPFRecord = txt
				report.SPFValid = true
				passed++
				break
			}
		}
	}
	if report.SPFRecord == "" {
		report.SPFRecord = "not published"
	}

	// DKIM (default selector, matching the key OpenDKIM signs with)
	checks++
	if txts, err := resolver.LookupTXT(ctx, "default._domainkey."+domain); err == nil {
		joined := strings.Join(txts, "")
		if strings.Contains(strings.ToLower(joined), "v=dkim1") {
			report.DKIMRecord = joined
			report.DKIMValid = NewMailPolicyService().DKIMSigningActive(domain)
			if report.DKIMValid {
				passed++
			} else {
				report.DKIMRecord = joined + " (published, but Postfix is not signing with it)"
			}
		}
	}
	if report.DKIMRecord == "" {
		report.DKIMRecord = "not published"
	}

	// DMARC
	checks++
	if txts, err := resolver.LookupTXT(ctx, "_dmarc."+domain); err == nil {
		for _, txt := range txts {
			if strings.HasPrefix(strings.ToLower(txt), "v=dmarc1") {
				report.DMARCRecord = txt
				report.DMARCValid = true
				passed++
				break
			}
		}
	}
	if report.DMARCRecord == "" {
		report.DMARCRecord = "not published"
	}

	// MX
	checks++
	if mxs, err := resolver.LookupMX(ctx, domain); err == nil && len(mxs) > 0 {
		parts := make([]string, 0, len(mxs))
		for _, mx := range mxs {
			parts = append(parts, fmt.Sprintf("%s (priority %d)", strings.TrimSuffix(mx.Host, "."), mx.Pref))
		}
		report.MXRecord = strings.Join(parts, ", ")
		report.MXValid = true
		passed++
	} else {
		report.MXRecord = "not published"
	}

	// PTR must resolve to the SMTP banner hostname, not just to anything.
	checks++
	serverIP := s.dnsService.GetSystemIP()
	expectedHelo := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(postfixParam("myhostname"))), ".")
	if names, err := resolver.LookupAddr(ctx, serverIP); err == nil && len(names) > 0 {
		ptr := strings.TrimSuffix(strings.ToLower(names[0]), ".")
		report.PTRRecord = fmt.Sprintf("%s -> %s", serverIP, ptr)
		if expectedHelo != "" && ptr == expectedHelo {
			report.PTRValid = true
			passed++
		} else if expectedHelo != "" {
			report.PTRRecord += fmt.Sprintf(" (does not match SMTP HELO %s)", expectedHelo)
		}
	} else {
		report.PTRRecord = fmt.Sprintf("%s -> no reverse DNS (set it at your provider)", serverIP)
	}

	// CAA
	checks++
	if txts, err := resolver.LookupTXT(ctx, domain); err == nil {
		_ = txts // CAA is looked up separately below; TXT lookup keeps the resolver warm.
	}
	if records, err := lookupCAA(ctx, resolver, domain); err == nil && records != "" {
		report.CAARecord = records
		report.CAAValid = true
		passed++
	} else {
		report.CAARecord = "not published (any CA may issue)"
	}

	if checks > 0 {
		report.DeliverabilityRate = passed * 100 / checks
	}
	return report
}

// lookupCAA reads CAA records via the system resolver. Go has no typed CAA lookup, so the
// generic host lookup is used through `dig` when available and skipped otherwise.
func lookupCAA(ctx context.Context, _ *net.Resolver, domain string) (string, error) {
	cmd := exec.CommandContext(ctx, "dig", "+short", "CAA", domain)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(strings.ReplaceAll(strings.TrimSpace(string(out)), "\n", "; ")), nil
}

func postfixParam(name string) string {
	out, err := exec.Command("postconf", "-h", name).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func randomAlnum(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	raw := make([]byte, n)
	_, _ = rand.Read(raw)
	out := make([]byte, n)
	for i := range out {
		out[i] = letters[int(raw[i])%len(letters)]
	}
	return string(out)
}

func persistSecret(name string, n int) string {
	_ = os.MkdirAll(paths.EtcAKpanelSecrets, 0700)
	p := filepath.Join(paths.EtcAKpanelSecrets, name)
	if b, err := os.ReadFile(p); err == nil {
		s := strings.TrimSpace(string(b))
		if len(s) == n {
			return s
		}
		if n == 24 && len(s) > 24 {
			s = s[:24]
			_ = os.WriteFile(p, []byte(s), 0600)
			return s
		}
		if s != "" && n != 24 {
			return s
		}
	}
	s := randomAlnum(n)
	_ = os.WriteFile(p, []byte(s), 0600)
	return s
}

func mysqlRootExec(sql string) {
	_ = ExecMySQL(sql)
}

func writeRoundcubePHPConfig(dbPass, desKey string) {
	if len(desKey) < 24 {
		desKey = (desKey + "akpanel-webmail-key!!!!")[:24]
	}
	if len(desKey) > 24 {
		desKey = desKey[:24]
	}
	dsnUser := url.QueryEscape(dbPass)
	cfg := fmt.Sprintf(`<?php
$config = [];
$config['db_dsnw'] = 'mysql://roundcube:%s@127.0.0.1/roundcubemail';
$config['default_host'] = '127.0.0.1';
$config['default_port'] = 143;
$config['imap_host'] = '127.0.0.1:143';
$config['smtp_server'] = '127.0.0.1';
$config['smtp_port'] = 587;
$config['smtp_host'] = '127.0.0.1:587';
$config['smtp_user'] = '%%u';
$config['smtp_pass'] = '%%p';
$config['support_url'] = '';
$config['product_name'] = 'AKpanel Webmail';
$config['des_key'] = '%s';
$config['plugins'] = ['akpanel_sso'];
$config['skin'] = 'elastic';
$config['enable_spellcheck'] = false;
$config['auto_create_user'] = true;
$config['login_autocomplete'] = 2;
$config['log_dir'] = '/var/log/roundcube/';
$config['temp_dir'] = '/var/lib/roundcube/temp/';
$config['ip_check'] = false;
$prefix = strtolower(trim((string)($_SERVER['HTTP_X_FORWARDED_PREFIX'] ?? '')));
if ($prefix === '/roundcube' || $prefix === '/webmail') {
  $config['request_path'] = $prefix;
} else {
  $config['request_path'] = '';
}
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
$config['use_https'] = $https;
$config['force_https'] = false;
$config['session_lifetime'] = 10;
$config['session_samesite'] = 'Lax';
$config['imap_conn_options'] = [
  'ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true],
];
$config['smtp_conn_options'] = [
  'ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true],
];
`, dsnUser, desKey)
	_ = os.MkdirAll("/etc/roundcube", 0755)
	_ = os.WriteFile("/etc/roundcube/config.inc.php", []byte(cfg), 0640)
	_ = exec.Command("chown", "root:www-data", "/etc/roundcube/config.inc.php").Run()
}

func writeRoundcubeSSOPlugin(rcRoot string) {
	plugin := `<?php
// AKpanel webmail single sign-on. The panel issues a one-time token that maps to a
// short-lived Dovecot credential for a single mailbox; this plugin consumes it.
class akpanel_sso extends rcube_plugin
{
    public $task = 'login';

    private $token = null;
    private $tokenDir = '/var/lib/akpanel/webmail-sso';

    function init()
    {
        $this->add_hook('startup', array($this, 'startup'));
        $this->add_hook('authenticate', array($this, 'authenticate'));
        $this->add_hook('login_after', array($this, 'login_after'));
        $this->add_hook('login_failed', array($this, 'login_failed'));
    }

    private function token()
    {
        if ($this->token === null) {
            $raw = isset($_GET['sso']) ? (string)$_GET['sso'] : '';
            $this->token = preg_replace('/[^a-zA-Z0-9]/', '', $raw);
        }
        return $this->token;
    }

    private function tokenFile()
    {
        return $this->tokenDir . '/' . $this->token() . '.json';
    }

    private function record()
    {
        if ($this->token() === '') {
            return null;
        }
        $raw = @file_get_contents($this->tokenFile());
        if ($raw === false) {
            return null;
        }
        $d = json_decode($raw, true);
        if (!is_array($d) || empty($d['imap_user']) || empty($d['imap_pass'])) {
            return null;
        }
        if ((int)(isset($d['expires_at']) ? $d['expires_at'] : 0) < time()) {
            return null;
        }
        return $d;
    }

    private function trace($message)
    {
        @file_put_contents('/var/log/roundcube/akpanel-sso.log',
            gmdate('c') . ' ' . $message . "\n", FILE_APPEND);
    }

    function startup($args)
    {
        if ($this->token() !== '' && $args['task'] === 'login') {
            $args['action'] = 'login';
            $_POST['_task'] = 'login';
            $_POST['_action'] = 'login';
        }
        return $args;
    }

    function authenticate($args)
    {
        if ($this->token() === '') {
            return $args;
        }
        $d = $this->record();
        if ($d === null) {
            $this->trace('token rejected (missing, malformed or expired)');
            return $args;
        }
        // Plain mailbox address as username: Roundcube passes it through
        // idn_to_ascii(), which would blank out a "user*master" style login.
        $args['user'] = $d['imap_user'];
        $args['pass'] = $d['imap_pass'];
        $args['valid'] = true;
        $args['cookiecheck'] = false;
        return $args;
    }

    function login_after($args)
    {
        if ($this->token() !== '') {
            @unlink($this->tokenFile());
        }
        return $args;
    }

    function login_failed($args)
    {
        if ($this->token() !== '') {
            @unlink($this->tokenFile());
            $this->trace('IMAP login failed for ' . (isset($args['user']) ? $args['user'] : '?')
                . ' code=' . (isset($args['code']) ? $args['code'] : '?'));
        }
        return $args;
    }
}
`
	for _, root := range []string{rcRoot, "/usr/share/roundcube"} {
		dir := filepath.Join(root, "plugins", "akpanel_sso")
		_ = os.MkdirAll(dir, 0755)
		_ = os.WriteFile(filepath.Join(dir, "akpanel_sso.php"), []byte(plugin), 0644)
	}
}

func importRoundcubeSQL(sqlFile string) {
	f, err := os.Open(sqlFile)
	if err != nil {
		return
	}
	defer f.Close()
	rootPass := ""
	if b, err := os.ReadFile(filepath.Join(paths.EtcAKpanelSecrets, "mysql_root")); err == nil {
		rootPass = strings.TrimSpace(string(b))
	}
	var cmd *exec.Cmd
	if rootPass != "" {
		cmd = exec.Command("mysql", "-u", "root", "-p"+rootPass, "roundcubemail")
	} else {
		cmd = exec.Command("mysql", "--protocol=socket", "-u", "root", "roundcubemail")
	}
	cmd.Stdin = f
	_ = cmd.Run()
}

func ensurePHPIntl() {
	// php-intl is installed by the installer. Never apt-get on an API request.
}

func (s *EmailService) EnsureRoundcubeWebmail() {
	ensurePHPIntl()
	dbPass := persistSecret("roundcube_db_pass", 24)
	desKey := persistSecret("roundcube_des_key", 24)
	mysqlRootExec(fmt.Sprintf(
		"CREATE DATABASE IF NOT EXISTS roundcubemail DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'roundcube'@'localhost' IDENTIFIED BY '%s'; CREATE USER IF NOT EXISTS 'roundcube'@'127.0.0.1' IDENTIFIED BY '%s'; ALTER USER 'roundcube'@'localhost' IDENTIFIED BY '%s'; ALTER USER 'roundcube'@'127.0.0.1' IDENTIFIED BY '%s'; GRANT ALL PRIVILEGES ON roundcubemail.* TO 'roundcube'@'localhost'; GRANT ALL PRIVILEGES ON roundcubemail.* TO 'roundcube'@'127.0.0.1'; FLUSH PRIVILEGES;",
		dbPass, dbPass, dbPass, dbPass,
	))
	for _, sqlFile := range []string{
		"/usr/share/roundcube/SQL/mysql.initial.sql",
		"/usr/share/roundcube/SQL/mysql/initial.sql",
	} {
		if _, err := os.Stat(sqlFile); err == nil {
			importRoundcubeSQL(sqlFile)
			break
		}
	}
	writeRoundcubePHPConfig(dbPass, desKey)
	writeRoundcubeSSOPlugin(paths.RoundcubeWebRoot())
	_ = os.MkdirAll("/var/lib/akpanel/webmail-sso", 0750)
	_ = exec.Command("chown", "root:www-data", "/var/lib/akpanel/webmail-sso").Run()

	rcRoot := paths.RoundcubeWebRoot()
	_ = os.MkdirAll("/var/lib/roundcube/temp", 0750)
	_ = os.MkdirAll(rcRoot+"/temp", 0750)
	_ = os.MkdirAll("/var/log/roundcube", 0755)
	_ = exec.Command("chown", "-R", "www-data:www-data", "/var/lib/roundcube/temp", rcRoot+"/temp", "/var/log/roundcube").Run()

	nginx := NewNginxService()
	_ = nginx.EnsureRoundcubeListener()
	nginx.RepairPanelServiceVhosts()

	apacheConf := fmt.Sprintf(`Alias /webmail %s
Alias /roundcube %s

<Directory %s>
    Options +FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
`, rcRoot, rcRoot, rcRoot)
	_ = os.MkdirAll("/etc/apache2/conf-available", 0755)
	_ = os.WriteFile("/etc/apache2/conf-available/roundcube.conf", []byte(apacheConf), 0644)
	_ = exec.Command("bash", "-c", "a2enconf roundcube 2>/dev/null; systemctl reload apache2 2>/dev/null || service apache2 reload 2>/dev/null").Run()

	phpSock := "unix:/run/php/php8.3-fpm.sock"
	for _, ver := range []string{"8.3", "8.2", "8.1", "8.0", "7.4"} {
		sock := fmt.Sprintf("/run/php/php%s-fpm.sock", ver)
		if _, err := os.Stat(sock); err == nil {
			phpSock = fmt.Sprintf("unix:%s", sock)
			break
		}
	}
	_ = os.MkdirAll("/etc/nginx/snippets", 0755)
	nginxSnippet := fmt.Sprintf(`location /webmail {
    alias %s;
    index index.php index.html;
    try_files $uri $uri/ /webmail/index.php?$query_string;
    location ~ \.php$ {
        try_files $uri =404;
        include fastcgi_params;
        fastcgi_pass %s;
        fastcgi_param SCRIPT_FILENAME $request_filename;
        fastcgi_read_timeout 300;
    }
}
`, rcRoot, phpSock)
	_ = os.WriteFile("/etc/nginx/snippets/webmail.conf", []byte(nginxSnippet), 0644)
	_ = exec.Command("bash", "-c", "nginx -t 2>/dev/null && (systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null)").Run()
}

type webmailSSORecord struct {
	Email     string `json:"email"`
	IMAPUser  string `json:"imap_user"`
	IMAPPass  string `json:"imap_pass"`
	ExpiresAt int64  `json:"expires_at"`
}

func (s *EmailService) IssueWebmailSSOToken(email string) (string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if !s.AccountExists(email) {
		return "", fmt.Errorf("mailbox not found")
	}
	dir := "/var/lib/akpanel/webmail-sso"
	_ = os.MkdirAll(dir, 0750)
	_ = exec.Command("chown", "root:www-data", dir).Run()
	token := randomAlnum(32)
	imapPass, err := GetMailAuthService().IssueSSOPassword(email)
	if err != nil {
		return "", err
	}
	rec := webmailSSORecord{Email: email, IMAPUser: email, IMAPPass: imapPass, ExpiresAt: time.Now().Add(2 * time.Minute).Unix()}
	bytes, _ := json.Marshal(rec)
	if err := os.WriteFile(filepath.Join(dir, token+".json"), bytes, 0640); err != nil {
		return "", err
	}
	_ = exec.Command("chown", "root:www-data", filepath.Join(dir, token+".json")).Run()
	return token, nil
}

func PeekWebmailSSOToken(token string) bool {
	token = strings.TrimSpace(token)
	if token == "" || strings.ContainsAny(token, "/.\\") {
		return false
	}
	b, err := os.ReadFile(filepath.Join("/var/lib/akpanel/webmail-sso", token+".json"))
	if err != nil {
		return false
	}
	var rec webmailSSORecord
	if json.Unmarshal(b, &rec) != nil || rec.Email == "" || rec.ExpiresAt < time.Now().Unix() {
		return false
	}
	return true
}

// ConsumeWebmailSSOToken returns mailbox email for a valid one-time token.
func ConsumeWebmailSSOToken(token string) (string, error) {
	token = strings.TrimSpace(token)
	if token == "" || strings.ContainsAny(token, "/.\\") {
		return "", fmt.Errorf("invalid token")
	}
	p := filepath.Join("/var/lib/akpanel/webmail-sso", token+".json")
	b, err := os.ReadFile(p)
	_ = os.Remove(p)
	if err != nil {
		return "", fmt.Errorf("token expired")
	}
	var rec webmailSSORecord
	if json.Unmarshal(b, &rec) != nil || rec.Email == "" || rec.ExpiresAt < time.Now().Unix() {
		return "", fmt.Errorf("token expired")
	}
	return rec.Email, nil
}
