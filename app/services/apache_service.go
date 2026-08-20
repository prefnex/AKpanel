package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"goravel/app/paths"
)

type ApacheService struct {
	sitesAvailablePath string
	sitesEnabledPath   string
	sitesRootPath      string
	internalPort       int
}

func NewApacheService() *ApacheService {
	return &ApacheService{
		sitesAvailablePath: paths.ApacheAvailableDir,
		sitesEnabledPath:   paths.ApacheEnabledDir,
		sitesRootPath:      paths.SitesRoot,
		internalPort:       8081, // Apache internal port in Hybrid mode
	}
}

// CreateApacheVhost generates an Apache virtual host with full .htaccess and mod_rewrite support
func (a *ApacheService) CreateApacheVhost(cfg WebsiteConfig, isHybrid bool) error {
	if cfg.Domain == "" {
		return fmt.Errorf("domain cannot be empty")
	}

	port := 80
	if isHybrid {
		port = a.internalPort
		if err := a.EnsureInternalBackend(); err != nil {
			return err
		}
	}

	if cfg.RootPath == "" {
		cfg.RootPath = fmt.Sprintf("%s/%s/public", a.sitesRootPath, cfg.Domain)
	}

	_ = os.MkdirAll(cfg.RootPath, 0755)
	_ = os.MkdirAll(a.sitesAvailablePath, 0755)
	_ = os.MkdirAll(a.sitesEnabledPath, 0755)

	// Create default .htaccess if not present
	htaccessPath := filepath.Join(cfg.RootPath, ".htaccess")
	if _, err := os.Stat(htaccessPath); os.IsNotExist(err) {
		defaultHtaccess := `<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.php [L]
</IfModule>
`
		_ = os.WriteFile(htaccessPath, []byte(defaultHtaccess), 0644)
	}

	// Generate Apache Vhost config
	vhostContent := a.generateApacheConfig(cfg, port)
	availableFile := filepath.Join(a.sitesAvailablePath, fmt.Sprintf("%s.conf", cfg.Domain))
	enabledFile := filepath.Join(a.sitesEnabledPath, fmt.Sprintf("%s.conf", cfg.Domain))

	if err := os.WriteFile(availableFile, []byte(vhostContent), 0644); err != nil {
		return fmt.Errorf("failed to write apache vhost: %w", err)
	}

	// Enable site via symlink
	_ = os.Remove(enabledFile)
	if err := os.Symlink(availableFile, enabledFile); err != nil {
		return fmt.Errorf("failed to enable apache vhost: %w", err)
	}

	// Test & Reload Apache if installed
	return a.ReloadApache()
}

// DeleteApacheVhost removes Apache virtual host
func (a *ApacheService) DeleteApacheVhost(domain string) error {
	availableFile := filepath.Join(a.sitesAvailablePath, fmt.Sprintf("%s.conf", domain))
	enabledFile := filepath.Join(a.sitesEnabledPath, fmt.Sprintf("%s.conf", domain))

	_ = os.Remove(enabledFile)
	_ = os.Remove(availableFile)

	return a.ReloadApache()
}

// ReloadApache tests config and reloads Apache service
func (a *ApacheService) ReloadApache() error {
	if output, err := exec.Command("apache2ctl", "configtest").CombinedOutput(); err != nil {
		return fmt.Errorf("apache syntax test failed: %s", string(output))
	}
	_ = exec.Command("a2enmod", "proxy", "proxy_fcgi", "rewrite", "headers").Run()
	if err := exec.Command("service", "apache2", "reload").Run(); err != nil {
		_ = os.Remove("/var/run/apache2/apache2.pid")
		_ = exec.Command("service", "apache2", "start").Run()
	}
	return nil
}

// EnsureInternalBackend makes Apache an internal backend for Nginx. Letting
// Apache bind port 80 while Nginx is active causes a port collision and makes
// sites selected as "Apache" appear created but unreachable.
func (a *ApacheService) EnsureInternalBackend() error {
	portsPath := "/etc/apache2/ports.conf"
	content, err := os.ReadFile(portsPath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	lines := strings.Split(string(content), "\n")
	filtered := make([]string, 0, len(lines)+1)
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "Listen 80" || trimmed == "Listen 8081" || trimmed == "Listen 127.0.0.1:8081" {
			continue
		}
		filtered = append(filtered, line)
	}
	filtered = append(filtered, "Listen 127.0.0.1:8081")
	if err := os.WriteFile(portsPath, []byte(strings.Join(filtered, "\n")), 0644); err != nil {
		return err
	}

	// Ubuntu's default port-80 vhost must not remain enabled after Apache moves
	// behind Nginx. AKpanel creates explicit per-domain 8081 vhosts instead.
	_ = os.Remove(filepath.Join(a.sitesEnabledPath, "000-default.conf"))
	_ = os.Remove(filepath.Join(a.sitesEnabledPath, "default-ssl.conf"))
	return nil
}

func (a *ApacheService) generateApacheConfig(cfg WebsiteConfig, port int) string {
	return fmt.Sprintf(`<VirtualHost *:%d>
    ServerName %s
    ServerAlias www.%s
    DocumentRoot %s

    <Directory %s>
        Options -Indexes +FollowSymLinks +MultiViews
        AllowOverride All
        Require all granted
    </Directory>

    <FilesMatch \.php$>
        SetHandler "proxy:unix:/run/php/php%s-fpm.sock|fcgi://localhost"
    </FilesMatch>

    ErrorLog /var/log/apache2/%s_error.log
    CustomLog /var/log/apache2/%s_access.log combined
</VirtualHost>
`, port, cfg.Domain, cfg.Domain, cfg.RootPath, cfg.RootPath, cfg.PHPVersion, cfg.Domain, cfg.Domain)
}
