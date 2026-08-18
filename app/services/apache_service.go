package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

type ApacheService struct {
	sitesAvailablePath string
	sitesEnabledPath   string
	sitesRootPath      string
	internalPort       int
}

func NewApacheService() *ApacheService {
	return &ApacheService{
		sitesAvailablePath: "/etc/apache2/sites-available",
		sitesEnabledPath:   "/etc/apache2/sites-enabled",
		sitesRootPath:      "/var/www/sites",
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
	cmd := exec.Command("apache2ctl", "graceful")
	if err := cmd.Run(); err != nil {
		cmdService := exec.Command("service", "apache2", "reload")
		_ = cmdService.Run()
	}
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
