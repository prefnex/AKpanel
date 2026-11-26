package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"goravel/app/models"
	"goravel/app/paths"
)

// WebsiteConfig describes one site. Backend/PHPHandler/Varnish are the per-domain request
// (see domain.SiteStack); ServerEngine is the legacy engine string still accepted from
// packages and old callers. A stored per-domain choice in the websites table wins over both.
type WebsiteConfig struct {
	Domain           string `json:"domain"`
	ServerEngine     string `json:"server_engine"` // legacy: "nginx", "apache", "hybrid", …
	Backend          string `json:"backend"`       // "apache" | "nginx" | "" (mode default)
	PHPHandler       string `json:"php_handler"`   // "fpm" | "cgi" (Apache only)
	Varnish          string `json:"varnish"`       // "on" | "off" | "" (mode default)
	TemplateID       string `json:"template_id"`   // e.g. "laravel", "wordpress", "nodejs"
	PHPVersion       string `json:"php_version"`   // e.g. "8.2", "8.3"
	SiteType         string `json:"site_type"`     // "php", "static", "proxy"
	ProxyPort        int    `json:"proxy_port"`    // for reverse proxy
	ProxyHost        string `json:"proxy_host"`    // reverse proxy upstream host ("" = 127.0.0.1)
	RootPath         string `json:"root_path"`
	OwnerUsername    string `json:"owner_username"`
	PHPSocket        string `json:"php_socket"`         // optional per-user FPM socket
	SkipOwnershipFix bool   `json:"skip_ownership_fix"` // skip www-data chown for client sites
}

// NginxService is the historical entry point for site vhosts. All rendering now lives in
// WebStackService; these methods prepare document roots and delegate.
type NginxService struct {
	sitesAvailablePath string
	sitesEnabledPath   string
	sitesRootPath      string
}

var builtinServicesOnce sync.Once

func NewNginxService() *NginxService {
	builtinServicesOnce.Do(func() { _ = GetWebStack().EnsureBuiltinServices() })
	return &NginxService{
		sitesAvailablePath: paths.NginxAvailableDir,
		sitesEnabledPath:   paths.NginxEnabledDir,
		sitesRootPath:      paths.SitesRoot,
	}
}

// getActivePHPSocket is the shared FPM socket of the server default PHP (paths.DefaultPHPVersion).
func (n *NginxService) getActivePHPSocket() string {
	return "unix:" + paths.PHPSocket(paths.DefaultPHPVersion())
}

func (n *NginxService) resolvePHPSocket(cfg WebsiteConfig) string {
	return resolveSitePHPSocket(cfg)
}

// resolveSitePHPSocket picks the FPM socket a site's PHP runs on ("unix:/run/php/…").
// Account-owned sites use the account's own pool (open_basedir, account uid) whenever the
// account has one — even if its socket is not up yet because FPM is restarting.
// Nginx and Apache vhosts both go through here so the two never disagree.
func resolveSitePHPSocket(cfg WebsiteConfig) string {
	owner := strings.TrimSpace(cfg.OwnerUsername)
	if owner == "" {
		owner = linuxAccountFromPath(cfg.RootPath)
	}
	if owner != "" && owner != "root" && owner != "admin" {
		if sock := strings.TrimPrefix(cfg.PHPSocket, "unix:"); sock != "" {
			return "unix:" + sock
		}
		if ver := accountPoolVersion(owner, cfg.PHPVersion); ver != "" {
			return "unix:" + paths.PHPSocketForUser(ver, owner)
		}
		// Legacy account without a pool: keep serving through the shared pool.
	}
	if sock := strings.TrimPrefix(cfg.PHPSocket, "unix:"); sock != "" {
		if _, err := os.Stat(sock); err == nil {
			return "unix:" + sock
		}
	}
	return "unix:" + paths.PHPSocket(paths.DetectInstalledPHPVersion(cfg.PHPVersion))
}

// accountPoolVersion returns the PHP version the account's FPM pool is configured on,
// preferring the requested version; "" when the account has no pool at all.
func accountPoolVersion(username, preferred string) string {
	if !IsValidAccountUsername(username) {
		return ""
	}
	if paths.IsPHPVersionString(preferred) {
		if _, err := os.Stat(fmt.Sprintf("/etc/php/%s/fpm/pool.d/%s.conf", preferred, username)); err == nil {
			return preferred
		}
	}
	matches, _ := filepath.Glob(fmt.Sprintf("/etc/php/*/fpm/pool.d/%s.conf", username))
	for _, m := range matches {
		if v := filepath.Base(filepath.Dir(filepath.Dir(filepath.Dir(m)))); paths.PHPFPMInstalled(v) {
			return v
		}
	}
	return ""
}

// CreateWebsite prepares the document root and applies the site's vhosts for the current mode.
func (n *NginxService) CreateWebsite(cfg WebsiteConfig) error {
	if cfg.Domain == "" {
		return fmt.Errorf("domain cannot be empty")
	}
	if cfg.RootPath == "" {
		switch cfg.TemplateID {
		case "react_spa":
			cfg.RootPath = fmt.Sprintf("%s/%s/dist", n.sitesRootPath, cfg.Domain)
		default:
			cfg.RootPath = fmt.Sprintf("%s/%s/public", n.sitesRootPath, cfg.Domain)
		}
	}
	if cfg.SiteType != "proxy" {
		if err := os.MkdirAll(cfg.RootPath, 0755); err != nil {
			return fmt.Errorf("failed to create document root: %w", err)
		}
		n.createStarterFiles(cfg)
	}
	if !cfg.SkipOwnershipFix && cfg.SiteType != "proxy" {
		if strings.HasPrefix(cfg.RootPath, paths.UserHomes+"/") {
			if acc := linuxAccountFromPath(cfg.RootPath); acc != "" {
				_ = exec.Command("chown", "-R", acc+":"+acc, cfg.RootPath).Run()
			}
		} else {
			_ = exec.Command("chown", "-R", "www-data:www-data", filepath.Dir(cfg.RootPath)).Run()
		}
	}
	_, err := GetWebStack().ApplySite(cfg)
	return err
}

// UpdateWebsiteRoot moves a site to a new document root (stored stack is kept).
func (n *NginxService) UpdateWebsiteRoot(domainName, rootPath string) error {
	if panelOrm() != nil {
		_, _ = panelOrm().Query().Model(&models.Website{}).Where("domain = ?", domainName).Update("root_path", rootPath)
	}
	cfg := WebsiteConfig{Domain: domainName, RootPath: rootPath}
	if row := lookupWebsiteRow(domainName); row != nil {
		cfg = websiteConfigFromRow(row)
		cfg.RootPath = rootPath
	}
	_, err := GetWebStack().ApplySite(cfg)
	return err
}

// DeleteWebsite removes every web server file for the domain.
func (n *NginxService) DeleteWebsite(domainName string) error {
	return GetWebStack().RemoveSite(domainName)
}

// TestConfig runs the syntax test of every daemon the current mode uses.
func (n *NginxService) TestConfig() error {
	mode := CurrentMode()
	if mode.HasNginx() {
		if err := testNginx(); err != nil {
			return err
		}
	}
	if mode.HasApache() {
		return testApache()
	}
	return nil
}

// ReloadNginx reloads the web servers of the current mode (name kept for old callers).
func (n *NginxService) ReloadNginx() error {
	mode := CurrentMode()
	if err := n.TestConfig(); err != nil {
		return err
	}
	if mode.HasNginx() {
		if err := reloadUnit("nginx"); err != nil {
			return err
		}
	}
	if mode.HasApache() {
		return reloadUnit("apache2")
	}
	return nil
}

func (n *NginxService) createStarterFiles(cfg WebsiteConfig) {
	indexPhpPath := filepath.Join(cfg.RootPath, "index.php")
	indexHtmlPath := filepath.Join(cfg.RootPath, "index.html")
	if _, err := os.Stat(indexHtmlPath); os.IsNotExist(err) {
		if _, err := os.Stat(indexPhpPath); os.IsNotExist(err) {
			_ = WriteWelcomeIndex(indexPhpPath, cfg.Domain, cfg.OwnerUsername)
		}
	}
}

// EnsureDefaultNginxConfig renders the default server and loopback panel listeners.
func (n *NginxService) EnsureDefaultNginxConfig() {
	_ = GetWebStack().EnsureBuiltinServices()
}

// EnsureRoundcubeListener serves Roundcube on 127.0.0.1:8086 for the panel /webmail proxy.
func (n *NginxService) EnsureRoundcubeListener() error {
	return GetWebStack().EnsureBuiltinServices()
}

// EnsurePhpMyAdminListener serves phpMyAdmin on 127.0.0.1:8085 for the panel reverse proxy.
func (n *NginxService) EnsurePhpMyAdminListener() error {
	return GetWebStack().EnsureBuiltinServices()
}

// CreateProxyVhost reverse-proxies domain to a local port with optional extra headers.
func (n *NginxService) CreateProxyVhost(domainName string, port int, extraHeaders map[string]string) error {
	return GetWebStack().EnsureServiceVhost(ServiceVhost{Name: domainName, Kind: "proxy", Host: domainName, Port: port, Headers: extraHeaders})
}

// CreateStaticInfoVhost serves a simple informational page for service subdomains (ftp/imap/pop).
func (n *NginxService) CreateStaticInfoVhost(domainName, title, bodyHTML string) error {
	root := filepath.Join("/var/www/sites/_service", domainName)
	_ = os.MkdirAll(root, 0755)
	_ = os.WriteFile(filepath.Join(root, "index.html"), []byte(fmt.Sprintf(`<!DOCTYPE html><html><head><title>%s</title></head><body>%s</body></html>`, title, bodyHTML)), 0644)
	return GetWebStack().EnsureServiceVhost(ServiceVhost{Name: domainName, Kind: "info", Host: domainName, Root: root})
}

// EnsurePanelHostnameVhost: hostname :80 → https, :443 → https://host:2087.
func (n *NginxService) EnsurePanelHostnameVhost(hostname string) error {
	hostname = strings.ToLower(strings.TrimSpace(hostname))
	if hostname == "" || hostname == "localhost" {
		return nil
	}
	name := "akpanel-hostname-" + strings.ReplaceAll(hostname, ".", "_")
	return GetWebStack().EnsureServiceVhost(ServiceVhost{Name: name, Kind: "hostname", Host: hostname})
}

// CreateWebmailVhost serves Roundcube for webmail.{domain} (through the loopback listener).
func (n *NginxService) CreateWebmailVhost(host string) error {
	return GetWebStack().EnsureServiceVhost(ServiceVhost{Name: host, Kind: "webmail", Host: host})
}

// CreateClientPanelVhost proxies cpanel.{domain} to the tenant portal (not root WHM).
func (n *NginxService) CreateClientPanelVhost(host string) error {
	return GetWebStack().EnsureServiceVhost(clientPanelService(host))
}

// RepairPanelServiceVhosts re-renders every panel service vhost from the current templates.
func (n *NginxService) RepairPanelServiceVhosts() {
	_, _ = GetWebStack().RebuildServices()
}

// ensureNginxFastcgiParams keeps the fastcgi_params file nginx vhosts include.
func ensureNginxFastcgiParams() {
	if _, err := os.Stat("/etc/nginx/fastcgi_params"); err == nil {
		return
	}
	_ = os.MkdirAll("/etc/nginx", 0755)
	_ = os.WriteFile("/etc/nginx/fastcgi_params", []byte(`fastcgi_param QUERY_STRING      $query_string;
fastcgi_param REQUEST_METHOD    $request_method;
fastcgi_param CONTENT_TYPE      $content_type;
fastcgi_param CONTENT_LENGTH    $content_length;
fastcgi_param SCRIPT_NAME       $fastcgi_script_name;
fastcgi_param REQUEST_URI       $request_uri;
fastcgi_param DOCUMENT_URI      $document_uri;
fastcgi_param DOCUMENT_ROOT     $document_root;
fastcgi_param SERVER_PROTOCOL   $server_protocol;
fastcgi_param REQUEST_SCHEME    $scheme;
fastcgi_param HTTPS             $https if_not_empty;
fastcgi_param GATEWAY_INTERFACE CGI/1.1;
fastcgi_param SERVER_SOFTWARE   nginx;
fastcgi_param REMOTE_ADDR       $remote_addr;
fastcgi_param REMOTE_PORT       $remote_port;
fastcgi_param SERVER_ADDR       $server_addr;
fastcgi_param SERVER_PORT       $server_port;
fastcgi_param SERVER_NAME       $server_name;
fastcgi_param REDIRECT_STATUS   200;
`), 0644)
}

// applyIPStackToVhost drops IPv6 listeners when the host cannot serve them. Kernels booted
// with ipv6.disable=1 make nginx refuse to start on `listen [::]:80` with
// "Address family not supported by protocol", which takes down every site on the server.
func applyIPStackToVhost(conf string) string {
	if ipv6ListenSupported() {
		return conf
	}
	lines := strings.Split(conf, "\n")
	kept := make([]string, 0, len(lines))
	for _, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "listen [::]") {
			continue
		}
		kept = append(kept, line)
	}
	return strings.Join(kept, "\n")
}

// ipv6ListenSupported reports whether nginx can open an IPv6 socket on this host. The
// admin's ipv4_only choice is honoured as an explicit opt out.
func ipv6ListenSupported() bool {
	if settings, err := NewServerSettingsService().GetSettings(); err == nil && settings.IPStackMode == "ipv4_only" {
		return false
	}
	if _, err := os.Stat("/proc/net/if_inet6"); err != nil {
		return false
	}
	return true
}
