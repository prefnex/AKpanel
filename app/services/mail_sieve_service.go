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

const autoresponderStorePath = "/etc/akpanel/email_autoresponders.json"

// Autoresponder is a Sieve vacation rule attached to one mailbox.
type Autoresponder struct {
	Email      string `json:"email"`
	Domain     string `json:"domain"`
	Subject    string `json:"subject"`
	Body       string `json:"body"`
	IntervalDS int    `json:"interval_days"`
	Enabled    bool   `json:"enabled"`
	StartsAt   string `json:"starts_at"`
	EndsAt     string `json:"ends_at"`
	UpdatedAt  string `json:"updated_at"`
}

// MailSieveService renders panel autoresponders into per-mailbox Sieve scripts that
// Dovecot executes during LMTP delivery.
type MailSieveService struct {
	mu sync.Mutex
}

var (
	mailSieveOnce     sync.Once
	mailSieveInstance *MailSieveService
)

func NewMailSieveService() *MailSieveService {
	mailSieveOnce.Do(func() {
		mailSieveInstance = &MailSieveService{}
	})
	return mailSieveInstance
}

func (m *MailSieveService) List(domain string) []Autoresponder {
	m.mu.Lock()
	defer m.mu.Unlock()

	all := m.readLocked()
	domain = strings.TrimSpace(strings.ToLower(domain))
	if domain == "" || domain == "all" {
		return all
	}
	out := make([]Autoresponder, 0, len(all))
	for _, a := range all {
		if strings.EqualFold(a.Domain, domain) {
			out = append(out, a)
		}
	}
	return out
}

func (m *MailSieveService) Save(a Autoresponder) error {
	a.Email = strings.TrimSpace(strings.ToLower(a.Email))
	parts := strings.Split(a.Email, "@")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return fmt.Errorf("a valid mailbox address is required")
	}
	a.Domain = parts[1]
	a.Subject = strings.TrimSpace(a.Subject)
	a.Body = strings.TrimSpace(a.Body)
	if a.Subject == "" {
		a.Subject = "Out of office"
	}
	if a.Body == "" {
		return fmt.Errorf("the auto-reply message body is required")
	}
	if a.IntervalDS <= 0 {
		a.IntervalDS = 1
	}
	if a.IntervalDS > 30 {
		a.IntervalDS = 30
	}
	if !NewEmailService().AccountExists(a.Email) {
		return fmt.Errorf("mailbox %s does not exist", a.Email)
	}
	a.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	m.mu.Lock()
	defer m.mu.Unlock()

	list := m.readLocked()
	replaced := false
	for i := range list {
		if list[i].Email == a.Email {
			list[i] = a
			replaced = true
			break
		}
	}
	if !replaced {
		list = append(list, a)
	}
	if err := m.writeLocked(list); err != nil {
		return err
	}
	return m.renderLocked(a)
}

func (m *MailSieveService) Delete(email string) error {
	email = strings.TrimSpace(strings.ToLower(email))

	m.mu.Lock()
	defer m.mu.Unlock()

	list := m.readLocked()
	kept := make([]Autoresponder, 0, len(list))
	var removed *Autoresponder
	for i := range list {
		if list[i].Email == email {
			removed = &list[i]
			continue
		}
		kept = append(kept, list[i])
	}
	if removed == nil {
		return fmt.Errorf("no autoresponder configured for %s", email)
	}
	if err := m.writeLocked(kept); err != nil {
		return err
	}
	disabled := *removed
	disabled.Enabled = false
	return m.renderLocked(disabled)
}

// RenderAll rewrites every Sieve script, used after mailbox or Dovecot changes.
func (m *MailSieveService) RenderAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, a := range m.readLocked() {
		_ = m.renderLocked(a)
	}
}

func (m *MailSieveService) readLocked() []Autoresponder {
	list := []Autoresponder{}
	b, err := os.ReadFile(autoresponderStorePath)
	if err != nil {
		return list
	}
	_ = json.Unmarshal(b, &list)
	sort.Slice(list, func(i, j int) bool { return list[i].Email < list[j].Email })
	return list
}

func (m *MailSieveService) writeLocked(list []Autoresponder) error {
	body, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(autoresponderStorePath, body, 0644)
}

// renderLocked writes (or clears) the mailbox Sieve script. Dovecot compiles it on the
// next delivery, so no extra reload is needed.
func (m *MailSieveService) renderLocked(a Autoresponder) error {
	parts := strings.Split(a.Email, "@")
	if len(parts) != 2 {
		return fmt.Errorf("invalid mailbox address")
	}
	home := filepath.Join("/var/vmail", parts[1], parts[0])
	script := filepath.Join(home, ".dovecot.sieve")

	// Disabling must also work for a mailbox that was just deleted, so it never touches
	// the mailbox directory.
	if !a.Enabled {
		_ = os.Remove(script)
		_ = os.Remove(script + "c")
		return nil
	}
	if _, err := os.Stat(home); err != nil {
		return fmt.Errorf("mailbox directory %s is missing", home)
	}

	var b strings.Builder
	b.WriteString("# Managed by AKpanel — edits are overwritten.\n")
	b.WriteString("require [\"vacation\"];\n\n")
	b.WriteString("vacation\n")
	fmt.Fprintf(&b, "  :days %d\n", a.IntervalDS)
	fmt.Fprintf(&b, "  :subject %s\n", sieveQuote(a.Subject))
	fmt.Fprintf(&b, "  :addresses [%s]\n", sieveQuote(a.Email))
	fmt.Fprintf(&b, "  %s;\n", sieveQuote(a.Body))

	if err := os.WriteFile(script, []byte(b.String()), 0600); err != nil {
		return err
	}
	_ = os.Remove(script + "c")
	_ = exec.Command("chown", "vmail:vmail", script).Run()
	_ = os.MkdirAll(filepath.Join(home, "sieve"), 0700)
	_ = exec.Command("chown", "-R", "vmail:vmail", filepath.Join(home, "sieve")).Run()
	return nil
}

// sieveQuote renders a Sieve string literal, escaping the two characters that would
// otherwise terminate or splice it.
func sieveQuote(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "\"", "\\\"")
	s = strings.ReplaceAll(s, "\r\n", "\n")
	if strings.Contains(s, "\n") {
		return "text:\n" + s + "\n.\n"
	}
	return "\"" + s + "\""
}
