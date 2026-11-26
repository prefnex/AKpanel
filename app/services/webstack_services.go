package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"goravel/app/domain"
	"goravel/app/paths"
	"goravel/app/templates"
)

// Panel service vhosts: everything on :80/:443 (or loopback) that is not a customer site —
// the default server, the panel hostname, webmail./cpanel./ftp./imap./pop.<domain>, and the
// loopback Roundcube/phpMyAdmin listeners the panel proxies to. They are kept in a small
// registry so a mode switch can re-render them for whichever daemon owns the ports.

const (
	internalRoundcubeAddr = "127.0.0.1:8086"
	internalPMAAddr       = "127.0.0.1:8085"
	clientPortalPort      = 2088
)

// ServiceVhost is one registry entry. Name is the file name (without .conf).
type ServiceVhost struct {
	Name    string            `json:"name"`
	Kind    string            `json:"kind"` // hostname | webmail | client_panel | info | proxy
	Host    string            `json:"host"`
	Port    int               `json:"port,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Root    string            `json:"root,omitempty"`
	// Site is the customer domain this service subdomain belongs to (webmail.example.com →
	// example.com); empty for the panel's own vhosts. See site_services.go.
	Site string `json:"site,omitempty"`
}

type serviceView struct {
	Kind      string
	Host      string
	Port      int
	Headers   map[string]string
	Root      string
	Listen    string
	Rewrites  []string
	URLPrefix string
	PHPSocket string
	SSLCert   string
	SSLKey    string
	IPv6      bool
	AcmeRoot  string
}

func (w *WebStackService) loadServices() []ServiceVhost {
	var list []ServiceVhost
	if b, err := os.ReadFile(serviceVhostsJSON); err == nil {
		_ = json.Unmarshal(b, &list)
		return list
	}
	list = discoverLegacyServiceVhosts()
	w.saveServices(list)
	return list
}

func sortServices(list []ServiceVhost) {
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })
}

func (w *WebStackService) saveServices(list []ServiceVhost) {
	sortServices(list)
	if b, err := json.MarshalIndent(list, "", "  "); err == nil {
		_ = os.MkdirAll(filepath.Dir(serviceVhostsJSON), 0755)
		_ = os.WriteFile(serviceVhostsJSON, b, 0644)
	}
}

func (w *WebStackService) isRegisteredService(name string) bool {
	for _, s := range w.loadServices() {
		if s.Name == name {
			return true
		}
	}
	return false
}

func (w *WebStackService) unregisterService(name string) {
	list := w.loadServices()
	out := list[:0]
	for _, s := range list {
		if s.Name != name {
			out = append(out, s)
		}
	}
	if len(out) != len(list) {
		w.saveServices(out)
	}
}

var serverNameRe = regexp.MustCompile(`(?m)^\s*server_name\s+([^;\s]+)`)

// discoverLegacyServiceVhosts builds the registry from nginx files written before it existed.
func discoverLegacyServiceVhosts() []ServiceVhost {
	var list []ServiceVhost
	files, _ := filepath.Glob(filepath.Join(paths.NginxAvailableDir, "*.conf"))
	for _, f := range files {
		name := strings.TrimSuffix(filepath.Base(f), ".conf")
		body, _ := os.ReadFile(f)
		switch {
		case strings.HasPrefix(name, "akpanel-hostname-"):
			if m := serverNameRe.FindStringSubmatch(string(body)); m != nil {
				list = append(list, ServiceVhost{Name: name, Kind: "hostname", Host: m[1]})
			}
		case strings.HasPrefix(name, "webmail."):
			list = append(list, ServiceVhost{Name: name, Kind: "webmail", Host: name})
		case strings.HasPrefix(name, "cpanel."):
			list = append(list, clientPanelService(name))
		case strings.HasPrefix(name, "ftp."), strings.HasPrefix(name, "imap."), strings.HasPrefix(name, "pop."):
			list = append(list, ServiceVhost{Name: name, Kind: "info", Host: name, Root: filepath.Join("/var/www/sites/_service", name)})
		}
	}
	return list
}

func clientPanelService(host string) ServiceVhost {
	return ServiceVhost{
		Name: host, Kind: "client_panel", Host: host, Port: clientPortalPort,
		Headers: map[string]string{"X-Forwarded-Port": "2083", "X-Panel-Scope": "client"},
	}
}

func pmaRoot() string {
	for _, p := range []string{"/usr/share/phpmyadmin", "/usr/share/phpMyAdmin"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "/usr/share/phpmyadmin"
}

// builtinServices are rendered in every mode without being in the registry.
func builtinServices() []struct {
	nginxName, apacheName string
	view                  serviceView
} {
	sock := "unix:" + paths.PHPSocket(paths.DefaultPHPVersion())
	cert, key := fallbackSSLPaths()
	return []struct {
		nginxName, apacheName string
		view                  serviceView
	}{
		{"default", "000-akpanel-default.conf", serviceView{Kind: "default", Host: "localhost", Root: acmeWebRoot, PHPSocket: sock, SSLCert: cert, SSLKey: key}},
		{"akpanel-roundcube-internal.conf", "akpanel-roundcube-internal.conf", serviceView{Kind: "internal_php", Listen: internalRoundcubeAddr, Root: paths.RoundcubeWebRoot(), PHPSocket: sock}},
		{"akpanel-pma-internal.conf", "akpanel-pma-internal.conf", serviceView{
			Kind: "internal_php", Listen: internalPMAAddr, Root: pmaRoot(), PHPSocket: sock, URLPrefix: "/phpmyadmin",
			Rewrites: []string{`rewrite ^/phpmyadmin(/.*)$ $1 last;`, `rewrite ^/phpmyadmin$ /index.php last;`},
		}},
	}
}

func (w *WebStackService) serviceViewFor(s ServiceVhost) serviceView {
	v := serviceView{Kind: s.Kind, Host: s.Host, Port: s.Port, Headers: s.Headers, Root: s.Root}
	if s.Kind == "hostname" {
		if cert, key, ok := panelServerSSL(); ok {
			v.SSLCert, v.SSLKey = cert, key
		} else {
			v.SSLCert, v.SSLKey = siteSSLPaths(s.Host)
		}
	} else {
		v.SSLCert, v.SSLKey = siteSSLPaths(s.Host)
	}
	if v.Headers == nil {
		v.Headers = map[string]string{}
	}
	return v
}

func (w *WebStackService) renderOneService(t *fsTxn, mode domain.Mode, nginxFile, apacheFile string, v serviceView) error {
	v.IPv6 = ipv6ListenSupported()
	v.AcmeRoot = acmeWebRoot
	nAvail := filepath.Join(paths.NginxAvailableDir, nginxFile)
	nEnabled := filepath.Join(paths.NginxEnabledDir, nginxFile)
	aAvail := filepath.Join(paths.ApacheAvailableDir, apacheFile)
	aEnabled := filepath.Join(paths.ApacheEnabledDir, apacheFile)

	if mode.HasNginx() {
		if nginxInstalled() {
			conf, err := templates.Render("nginx", "service.conf.tmpl", v)
			if err != nil {
				return err
			}
			if err := t.Write(nAvail, applyIPStackToVhost(conf), 0644); err != nil {
				return err
			}
			if err := t.Symlink(nAvail, nEnabled); err != nil {
				return err
			}
		}
		t.Remove(aEnabled)
		t.Remove(aAvail)
		return nil
	}
	// Apache owns the ports: nginx files stay on disk (nginx is stopped) but are disabled.
	t.Remove(nEnabled)
	conf, err := templates.Render("apache", "service.conf.tmpl", v)
	if err != nil {
		return err
	}
	if err := t.Write(aAvail, conf, 0644); err != nil {
		return err
	}
	return t.Symlink(aAvail, aEnabled)
}

func (w *WebStackService) renderServices(t *fsTxn, mode domain.Mode) error {
	_ = os.MkdirAll(acmeWebRoot, 0755)
	if _, err := os.Stat(filepath.Join(acmeWebRoot, "index.php")); err != nil {
		_ = WriteWelcomeIndex(filepath.Join(acmeWebRoot, "index.php"), "AKpanel", "server")
	}
	t.Remove("/etc/nginx/sites-enabled/000-default")
	for _, b := range builtinServices() {
		if err := w.renderOneService(t, mode, b.nginxName, b.apacheName, b.view); err != nil {
			return fmt.Errorf("%s: %w", b.nginxName, err)
		}
	}
	for _, s := range w.loadServices() {
		if s.Kind == "info" && s.Root != "" {
			_ = os.MkdirAll(s.Root, 0755)
		}
		if err := w.renderOneService(t, mode, s.Name+".conf", s.Name+".conf", w.serviceViewFor(s)); err != nil {
			return fmt.Errorf("%s: %w", s.Name, err)
		}
	}
	return nil
}

// EnsureServiceVhost registers (or updates) a panel service vhost and applies it.
func (w *WebStackService) EnsureServiceVhost(s ServiceVhost) error {
	if s.Name == "" || strings.ContainsAny(s.Name, "/\\") {
		return fmt.Errorf("invalid service vhost name")
	}
	w.mu.Lock()
	defer w.mu.Unlock()

	list := w.loadServices()
	replaced := false
	for i := range list {
		if list[i].Name == s.Name {
			list[i] = s
			replaced = true
		}
	}
	if !replaced {
		list = append(list, s)
	}
	w.saveServices(list)

	mode := CurrentMode()
	t := newFSTxn()
	if s.Kind == "info" && s.Root != "" {
		_ = os.MkdirAll(s.Root, 0755)
	}
	if err := w.renderOneService(t, mode, s.Name+".conf", s.Name+".conf", w.serviceViewFor(s)); err != nil {
		t.Rollback()
		return err
	}
	if err := w.verifyAndReload(mode, t); err != nil {
		t.Rollback()
		return err
	}
	return nil
}

// EnsureBuiltinServices renders the default server and loopback listeners for the current
// mode (cheap when nothing changed: no test, no reload).
func (w *WebStackService) EnsureBuiltinServices() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	mode := CurrentMode()
	if apacheInstalled() && mode.HasApache() && applyApacheModules(mode) {
		_ = reloadUnit("apache2")
	}
	t := newFSTxn()
	if err := w.renderGlobals(t, mode); err != nil {
		t.Rollback()
		return err
	}
	for _, b := range builtinServices() {
		if err := w.renderOneService(t, mode, b.nginxName, b.apacheName, b.view); err != nil {
			t.Rollback()
			return err
		}
	}
	if !t.dirty {
		return nil
	}
	if err := w.verifyAndReload(mode, t); err != nil {
		t.Rollback()
		return err
	}
	return nil
}

// ── SSL paths (shared by sites and services) ──────────────────────────────────

func panelServerSSL() (string, string, bool) {
	cert := "/etc/akpanel/ssl/server/fullchain.pem"
	key := "/etc/akpanel/ssl/server/privkey.pem"
	if _, err := os.Stat(cert); err == nil {
		if _, err := os.Stat(key); err == nil {
			return cert, key, true
		}
	}
	return "", "", false
}

func fallbackSSLPaths() (string, string) {
	if cert, key, ok := panelServerSSL(); ok {
		return cert, key
	}
	cert := "/etc/ssl/certs/akpanel-selfsigned.crt"
	key := "/etc/ssl/private/akpanel-selfsigned.key"
	if _, err := os.Stat(cert); os.IsNotExist(err) {
		_ = os.MkdirAll("/etc/ssl/certs", 0755)
		_ = os.MkdirAll("/etc/ssl/private", 0700)
		_ = exec.Command("openssl", "req", "-x509", "-nodes", "-days", "3650", "-newkey", "rsa:2048",
			"-keyout", key, "-out", cert, "-subj", "/C=US/ST=Cloud/L=Host/O=AKpanel/CN=akpanel.local").Run()
	}
	return cert, key
}

// siteSSLPaths: /etc/akpanel/ssl/{domain} (or its parent for a wildcard), else the fallback.
func siteSSLPaths(domainName string) (string, string) {
	candidates := []string{domainName}
	if parts := strings.Split(domainName, "."); len(parts) > 2 {
		candidates = append(candidates, strings.Join(parts[1:], "."))
	}
	for _, name := range candidates {
		if domain.SSLCertsExist(name) {
			return domain.SSLCertPath(name), domain.SSLKeyPath(name)
		}
	}
	return fallbackSSLPaths()
}

// RebuildServices re-renders the panel service vhosts only.
func (w *WebStackService) RebuildServices() (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	mode := CurrentMode()
	t := newFSTxn()
	if err := w.renderServices(t, mode); err != nil {
		t.Rollback()
		return 0, err
	}
	if err := w.verifyAndReload(mode, t); err != nil {
		t.Rollback()
		return 0, err
	}
	return len(w.loadServices()), nil
}

// RefreshDomain re-renders whatever serves name (customer site or panel service vhost),
// e.g. after a certificate was issued so the vhost points at the new files.
func (w *WebStackService) RefreshDomain(name string) error {
	for _, s := range w.loadServices() {
		if s.Name == name || s.Host == name {
			return w.EnsureServiceVhost(s)
		}
	}
	if row := lookupWebsiteRow(name); row != nil {
		_, err := w.ApplySite(websiteConfigFromRow(row))
		return err
	}
	_, err := w.RebuildServices()
	return err
}
