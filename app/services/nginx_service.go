package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type WebsiteConfig struct {
	Domain      string `json:"domain"`
	ServerEngine string `json:"server_engine"` // "nginx", "apache", "hybrid"
	TemplateID  string `json:"template_id"`   // e.g. "laravel", "wordpress", "nodejs"
	PHPVersion  string `json:"php_version"`   // e.g. "8.2", "8.3", "none"
	SiteType    string `json:"site_type"`     // "php", "static", "proxy"
	ProxyPort   int    `json:"proxy_port"`    // for reverse proxy
	RootPath    string `json:"root_path"`
}

type NginxService struct {
	sitesAvailablePath string
	sitesEnabledPath   string
	sitesRootPath      string
	apacheService      *ApacheService
}

func NewNginxService() *NginxService {
	return &NginxService{
		sitesAvailablePath: "/etc/nginx/sites-available",
		sitesEnabledPath:   "/etc/nginx/sites-enabled",
		sitesRootPath:      "/var/www/sites",
		apacheService:      NewApacheService(),
	}
}

// CreateWebsite configures the selected web server engine (Nginx, Apache, or Hybrid)
func (n *NginxService) CreateWebsite(cfg WebsiteConfig) error {
	if cfg.Domain == "" {
		return fmt.Errorf("domain cannot be empty")
	}

	if cfg.ServerEngine == "" {
		cfg.ServerEngine = "nginx"
	}

	// Default root path
	if cfg.RootPath == "" {
		if cfg.TemplateID == "laravel" || cfg.TemplateID == "symfony_codeigniter" {
			cfg.RootPath = fmt.Sprintf("%s/%s/public", n.sitesRootPath, cfg.Domain)
		} else if cfg.TemplateID == "react_spa" {
			cfg.RootPath = fmt.Sprintf("%s/%s/dist", n.sitesRootPath, cfg.Domain)
		} else {
			cfg.RootPath = fmt.Sprintf("%s/%s/public", n.sitesRootPath, cfg.Domain)
		}
	}

	// 1. Create document root directory
	if err := os.MkdirAll(cfg.RootPath, 0755); err != nil {
		return fmt.Errorf("failed to create document root: %w", err)
	}

	// 2. Populate starter index file
	n.createStarterFiles(cfg)

	// 3. Set www-data ownership
	exec.Command("chown", "-R", "www-data:www-data", filepath.Dir(cfg.RootPath)).Run()

	// 4. Handle Server Engines
	switch cfg.ServerEngine {
	case "apache":
		// Remove Nginx site if any, then create Apache vhost
		_ = n.DeleteNginxOnly(cfg.Domain)
		return n.apacheService.CreateApacheVhost(cfg, false)

	case "hybrid":
		// 1. Create Apache vhost listening on internal port 8081
		if err := n.apacheService.CreateApacheVhost(cfg, true); err != nil {
			return err
		}
		// 2. Create Nginx vhost as frontend proxy on port 80/443
		return n.createNginxVhost(cfg, true)

	default: // "nginx"
		_ = n.apacheService.DeleteApacheVhost(cfg.Domain)
		return n.createNginxVhost(cfg, false)
	}
}

func (n *NginxService) createNginxVhost(cfg WebsiteConfig, isHybrid bool) error {
	vhostContent := n.generateVhostConfig(cfg, isHybrid)
	availableFile := filepath.Join(n.sitesAvailablePath, fmt.Sprintf("%s.conf", cfg.Domain))
	enabledFile := filepath.Join(n.sitesEnabledPath, fmt.Sprintf("%s.conf", cfg.Domain))

	_ = os.MkdirAll(n.sitesAvailablePath, 0755)
	_ = os.MkdirAll(n.sitesEnabledPath, 0755)

	if err := os.WriteFile(availableFile, []byte(vhostContent), 0644); err != nil {
		return fmt.Errorf("failed to write vhost config: %w", err)
	}

	_ = os.Remove(enabledFile)
	if err := os.Symlink(availableFile, enabledFile); err != nil {
		return fmt.Errorf("failed to symlink vhost config: %w", err)
	}

	if err := n.TestConfig(); err != nil {
		_ = os.Remove(enabledFile)
		_ = os.Remove(availableFile)
		return fmt.Errorf("nginx syntax test failed: %w", err)
	}

	return n.ReloadNginx()
}

func (n *NginxService) DeleteWebsite(domain string) error {
	_ = n.DeleteNginxOnly(domain)
	_ = n.apacheService.DeleteApacheVhost(domain)
	return nil
}

func (n *NginxService) DeleteNginxOnly(domain string) error {
	availableFile := filepath.Join(n.sitesAvailablePath, fmt.Sprintf("%s.conf", domain))
	enabledFile := filepath.Join(n.sitesEnabledPath, fmt.Sprintf("%s.conf", domain))

	_ = os.Remove(enabledFile)
	_ = os.Remove(availableFile)

	_ = n.TestConfig()
	return n.ReloadNginx()
}

func (n *NginxService) TestConfig() error {
	cmd := exec.Command("nginx", "-t")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s (error: %v)", strings.TrimSpace(string(output)), err)
	}
	return nil
}

func (n *NginxService) ReloadNginx() error {
	cmd := exec.Command("nginx", "-s", "reload")
	if err := cmd.Run(); err != nil {
		cmdService := exec.Command("service", "nginx", "reload")
		return cmdService.Run()
	}
	return nil
}

func (n *NginxService) createStarterFiles(cfg WebsiteConfig) {
	indexPhpPath := filepath.Join(cfg.RootPath, "index.php")
	indexHtmlPath := filepath.Join(cfg.RootPath, "index.html")

	if _, err := os.Stat(indexPhpPath); os.IsNotExist(err) {
		if _, errHtml := os.Stat(indexHtmlPath); os.IsNotExist(errHtml) {
			if cfg.SiteType == "php" {
				starterPhp := fmt.Sprintf(`<?php
// Welcome to %s on AKpanel
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>%s | Hosted on AKpanel</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B0F19; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #111827; padding: 2.5rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); text-align: center; max-width: 520px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
        h1 { color: #818cf8; margin-top: 0; font-size: 1.8rem; }
        p { color: #94a3b8; line-height: 1.6; }
        .badge { display: inline-block; background: #312e81; color: #a5b4fc; padding: 0.3rem 0.8rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; margin-bottom: 1.2rem; }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">ENGINE: %s | PHP <?php echo phpversion(); ?></div>
        <h1>%s is Live! 🚀</h1>
        <p>Template: <strong>%s</strong></p>
        <p>Document root: <code>%s</code></p>
    </div>
</body>
</html>`, cfg.Domain, cfg.Domain, strings.ToUpper(cfg.ServerEngine), cfg.Domain, cfg.TemplateID, cfg.RootPath)
				_ = os.WriteFile(indexPhpPath, []byte(starterPhp), 0644)
			} else {
				starterHtml := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>%s | Hosted on AKpanel</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B0F19; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #111827; padding: 2.5rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); text-align: center; max-width: 520px; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
        h1 { color: #818cf8; margin-top: 0; font-size: 1.8rem; }
        p { color: #94a3b8; line-height: 1.6; }
        .badge { display: inline-block; background: #312e81; color: #a5b4fc; padding: 0.3rem 0.8rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; margin-bottom: 1.2rem; }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">ENGINE: %s | STATIC / PROXY</div>
        <h1>%s is Live! 🚀</h1>
        <p>Template: <strong>%s</strong></p>
    </div>
</body>
</html>`, cfg.Domain, strings.ToUpper(cfg.ServerEngine), cfg.Domain, cfg.TemplateID)
				_ = os.WriteFile(indexHtmlPath, []byte(starterHtml), 0644)
			}
		}
	}
}

func (n *NginxService) generateVhostConfig(cfg WebsiteConfig, isHybrid bool) string {
	if cfg.PHPVersion == "" {
		cfg.PHPVersion = "8.2"
	}

	phpSocket := fmt.Sprintf("unix:/run/php/php%s-fpm.sock", cfg.PHPVersion)

	// Hybrid Mode: Nginx caches static assets and proxies PHP requests to Apache on port 8081
	if isHybrid {
		return fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    server_name %s www.%s;
    root %s;

    access_log /var/log/nginx/%s.access.log;
    error_log /var/log/nginx/%s.error.log;

    # Static files served directly by Nginx with aggressive caching
    location ~* \.(jpg|jpeg|gif|png|css|js|ico|svg|woff2|woff|ttf|mp4|webm)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        try_files $uri @apache;
    }

    # Pass dynamic requests to Apache backend on port 8081 (.htaccess support)
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location @apache {
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
`, cfg.Domain, cfg.Domain, cfg.RootPath, cfg.Domain, cfg.Domain)
	}

	// Reverse Proxy / Node / Python / Go
	if cfg.SiteType == "proxy" {
		return fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    server_name %s www.%s;

    access_log /var/log/nginx/%s.access.log;
    error_log /var/log/nginx/%s.error.log;

    location / {
        proxy_pass http://127.0.0.1:%d;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
`, cfg.Domain, cfg.Domain, cfg.Domain, cfg.Domain, cfg.ProxyPort)
	}

	// Static / SPA
	if cfg.SiteType == "static" {
		return fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    server_name %s www.%s;
    root %s;

    index index.html index.htm;

    access_log /var/log/nginx/%s.access.log;
    error_log /var/log/nginx/%s.error.log;

    location / {
        try_files $uri $uri/ /index.html =404;
    }

    location ~ /\.ht {
        deny all;
    }
}
`, cfg.Domain, cfg.Domain, cfg.RootPath, cfg.Domain, cfg.Domain)
	}

	// Default: Pure Nginx PHP FastCGI
	return fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    server_name %s www.%s;
    root %s;

    index index.php index.html index.htm;

    access_log /var/log/nginx/%s.access.log;
    error_log /var/log/nginx/%s.error.log;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass %s;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.ht {
        deny all;
    }
}
`, cfg.Domain, cfg.Domain, cfg.RootPath, cfg.Domain, cfg.Domain, phpSocket)
}
