package services

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"

	"goravel/app/facades"
)

// System redirects (CWP's system-redirects.conf): short paths that work on every domain,
// e.g. example.com/cpanel → the client panel, example.com/webmail → Roundcube. They are
// rendered once into an nginx snippet and an Apache include that every site vhost includes.

const (
	systemRedirectsJSON   = "/etc/akpanel/system_redirects.json"
	nginxRedirectsSnippet = "/etc/nginx/snippets/akpanel-redirects.conf"
	apacheRedirectsConf   = "/etc/apache2/akpanel/redirects.conf"
)

// SystemRedirect is one rule. Target may use {host} for the requested host name.
type SystemRedirect struct {
	Path   string `json:"path"`
	Target string `json:"target"`
	Code   int    `json:"code"` // 301 or 302
}

// SystemRedirects is the stored list.
type SystemRedirects struct {
	Enabled bool             `json:"enabled"`
	Rules   []SystemRedirect `json:"rules"`
}

var (
	redirectPathRe   = regexp.MustCompile(`^/[A-Za-z0-9._~-]+(/[A-Za-z0-9._~-]+)*$`)
	redirectTargetRe = regexp.MustCompile(`^(https?://[A-Za-z0-9.{}:\[\]-]+)?/?[A-Za-z0-9._~/?=&%#:+-]*$`)
)

func panelPorts() (admin, client int) {
	admin, client = 2087, 2083
	defer func() { _ = recover() }()
	if c := facades.Config(); c != nil {
		admin = c.GetInt("akpanel.admin_port", admin)
		client = c.GetInt("akpanel.client_port", client)
	}
	return
}

// DefaultSystemRedirects is the shipped list.
func DefaultSystemRedirects() SystemRedirects {
	admin, client := panelPorts()
	cp := fmt.Sprintf("https://{host}:%d", client)
	ap := fmt.Sprintf("https://{host}:%d", admin)
	return SystemRedirects{Enabled: true, Rules: []SystemRedirect{
		{"/cpanel", cp + "/", 301},
		{"/controlpanel", cp + "/", 301},
		{"/whm", ap + "/", 301},
		{"/akpanel", ap + "/", 301},
		{"/webmail", cp + "/webmail/", 301},
		{"/roundcube", cp + "/webmail/", 301},
		{"/phpmyadmin", cp + "/phpmyadmin/", 301},
	}}
}

// LoadSystemRedirects reads the list (the default when never saved).
func LoadSystemRedirects() SystemRedirects {
	b, err := os.ReadFile(systemRedirectsJSON)
	if err != nil {
		return DefaultSystemRedirects()
	}
	var r SystemRedirects
	if json.Unmarshal(b, &r) != nil {
		return DefaultSystemRedirects()
	}
	return r
}

// Validate checks every rule.
func (r SystemRedirects) Validate() error {
	seen := map[string]bool{}
	for i, x := range r.Rules {
		if !redirectPathRe.MatchString(x.Path) || len(x.Path) > 100 {
			return fmt.Errorf("rule %d: path must look like /name (letters, digits, . _ ~ -)", i+1)
		}
		if x.Path == "/.well-known" || strings.HasPrefix(x.Path, "/.well-known/") {
			return fmt.Errorf("rule %d: /.well-known is reserved for certificates", i+1)
		}
		if seen[x.Path] {
			return fmt.Errorf("rule %d: %s is listed twice", i+1, x.Path)
		}
		seen[x.Path] = true
		t := strings.ReplaceAll(x.Target, "{host}", "h")
		if x.Target == "" || len(x.Target) > 300 || !redirectTargetRe.MatchString(x.Target) || strings.ContainsAny(t, "{}") {
			return fmt.Errorf("rule %d: target must be a URL (https://…) or a path; {host} is the only placeholder", i+1)
		}
		if x.Code != 301 && x.Code != 302 {
			return fmt.Errorf("rule %d: code must be 301 or 302", i+1)
		}
	}
	return nil
}

func renderNginxRedirects(r SystemRedirects) string {
	var b strings.Builder
	b.WriteString("# Managed by AKpanel (System redirects) — included by every site vhost.\n")
	if !r.Enabled {
		return b.String()
	}
	for _, x := range r.Rules {
		target := strings.ReplaceAll(x.Target, "{host}", "$host")
		for _, p := range []string{x.Path, x.Path + "/"} {
			fmt.Fprintf(&b, "location = %s { return %d %s; }\n", p, x.Code, target)
		}
	}
	return b.String()
}

func renderApacheRedirects(r SystemRedirects) string {
	var b strings.Builder
	b.WriteString("# Managed by AKpanel (System redirects) — included by site vhosts when Apache faces clients.\n")
	if !r.Enabled || len(r.Rules) == 0 {
		return b.String()
	}
	b.WriteString("<IfModule mod_rewrite.c>\nRewriteEngine On\n")
	for _, x := range r.Rules {
		target := strings.ReplaceAll(x.Target, "{host}", "%{HTTP_HOST}")
		fmt.Fprintf(&b, "RewriteRule ^%s/?$ %s [R=%d,L]\n", regexp.QuoteMeta(x.Path), target, x.Code)
	}
	b.WriteString("</IfModule>\n")
	return b.String()
}

// writeSystemRedirects renders both include files into t.
func writeSystemRedirects(t *fsTxn, r SystemRedirects) error {
	if nginxInstalled() {
		if err := t.Write(nginxRedirectsSnippet, renderNginxRedirects(r), 0644); err != nil {
			return err
		}
	}
	if apacheInstalled() {
		_ = os.MkdirAll("/etc/apache2/akpanel", 0755)
		if err := t.Write(apacheRedirectsConf, renderApacheRedirects(r), 0644); err != nil {
			return err
		}
	}
	return nil
}

// SaveSystemRedirects stores and applies the list; a failing test restores the old files.
func (w *WebStackService) SaveSystemRedirects(r SystemRedirects) (SystemRedirects, error) {
	if r.Rules == nil {
		r.Rules = []SystemRedirect{}
	}
	for i := range r.Rules {
		r.Rules[i].Path = strings.TrimRight(strings.TrimSpace(r.Rules[i].Path), "/")
		r.Rules[i].Target = strings.TrimSpace(r.Rules[i].Target)
		if r.Rules[i].Code == 0 {
			r.Rules[i].Code = 301
		}
	}
	if err := r.Validate(); err != nil {
		return r, err
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	mode := CurrentMode()
	t := newFSTxn()
	if err := writeSystemRedirects(t, r); err != nil {
		t.Rollback()
		return r, err
	}
	b, _ := json.MarshalIndent(r, "", "  ")
	if err := t.Write(systemRedirectsJSON, string(b), 0644); err != nil {
		t.Rollback()
		return r, err
	}
	if err := w.verifyAndReload(mode, t); err != nil {
		t.Rollback()
		return r, err
	}
	return r, nil
}
