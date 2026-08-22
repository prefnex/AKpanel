package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"goravel/app/domain"
	"goravel/app/paths"
)

type WebsiteConfig struct {
	Domain           string `json:"domain"`
	ServerEngine     string `json:"server_engine"` // "nginx", "apache", "hybrid"
	TemplateID       string `json:"template_id"`   // e.g. "laravel", "wordpress", "nodejs"
	PHPVersion       string `json:"php_version"`   // e.g. "8.2", "8.3", "none"
	SiteType         string `json:"site_type"`     // "php", "static", "proxy"
	ProxyPort        int    `json:"proxy_port"`    // for reverse proxy
	RootPath         string `json:"root_path"`
	OwnerUsername    string `json:"owner_username"`
	PHPSocket        string `json:"php_socket"`         // optional per-user FPM socket
	SkipOwnershipFix bool   `json:"skip_ownership_fix"` // skip www-data chown for client sites
}

type NginxService struct {
	sitesAvailablePath string
	sitesEnabledPath   string
	sitesRootPath      string
	apacheService      *ApacheService
}

func NewNginxService() *NginxService {
	svc := &NginxService{
		sitesAvailablePath: paths.NginxAvailableDir,
		sitesEnabledPath:   paths.NginxEnabledDir,
		sitesRootPath:      paths.SitesRoot,
		apacheService:      NewApacheService(),
	}
	svc.EnsureDefaultNginxConfig()
	return svc
}

func readServerProfileID() string {
	b, err := os.ReadFile(paths.ServerProfileConf())
	if err != nil {
		return domain.ProfileNginxPHPFPM
	}
	return strings.TrimSpace(string(b))
}

func (n *NginxService) getActivePHPSocket() string {
	for _, ver := range []string{"8.4", "8.3", "8.2", "8.1", "8.0", "7.4"} {
		sock := fmt.Sprintf("/run/php/php%s-fpm.sock", ver)
		if _, err := os.Stat(sock); err == nil {
			return fmt.Sprintf("unix:%s", sock)
		}
	}
	return "unix:/run/php/php8.3-fpm.sock"
}

func (n *NginxService) resolvePHPSocket(cfg WebsiteConfig) string {
	try := func(path string) string {
		path = strings.TrimPrefix(path, "unix:")
		if path == "" {
			return ""
		}
		if _, err := os.Stat(path); err == nil {
			return "unix:" + path
		}
		return ""
	}
	if cfg.PHPSocket != "" {
		if hit := try(cfg.PHPSocket); hit != "" {
			return hit
		}
	}
	ver := paths.DetectInstalledPHPVersion(cfg.PHPVersion)
	if cfg.OwnerUsername != "" {
		if hit := try(paths.PHPSocketForUser(ver, cfg.OwnerUsername)); hit != "" {
			return hit
		}
	}
	if hit := try(fmt.Sprintf("/run/php/php%s-fpm.sock", ver)); hit != "" {
		return hit
	}
	return n.getActivePHPSocket()
}

func acmeChallengeLocation() string {
	return `    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

`
}

func (n *NginxService) phpFastcgiLocation(socket string) string {
	if socket == "" {
		socket = n.getActivePHPSocket()
	}
	n.ensureFastcgiParams()
	return fmt.Sprintf(`    location ~ \.php$ {
        try_files $uri =404;
        fastcgi_split_path_info ^(.+\.php)(/.*)$;
        fastcgi_pass %s;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
		fastcgi_read_timeout 300;
        fastcgi_buffers 16 16k;
        fastcgi_buffer_size 32k;
    }
`, socket)
}

func (n *NginxService) phpFastcgiLocationProxied(socket string) string {
	base := n.phpFastcgiLocation(socket)
	extra := `        set $ak_https $https;
        if ($http_x_forwarded_proto = "https") { set $ak_https "on"; }
        fastcgi_param HTTPS $ak_https;
        fastcgi_param HTTP_X_FORWARDED_PROTO $http_x_forwarded_proto;
        fastcgi_param HTTP_X_FORWARDED_HOST $http_x_forwarded_host;
`
	return strings.Replace(base, "        fastcgi_buffer_size 32k;\n    }", extra+"        fastcgi_buffer_size 32k;\n    }", 1)
}

func (n *NginxService) ensureFastcgiParams() {
	_ = os.MkdirAll("/etc/nginx/snippets", 0755)
	if _, err := os.Stat("/etc/nginx/fastcgi_params"); err != nil {
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
	// Distro snippets/fastcgi-php.conf uses a regex that does not match bare
	// /index.php (PATH_INFO required), which 404s the default site. Keep a
	// safe AKpanel snippet for templates that still include it.
	_ = os.WriteFile("/etc/nginx/snippets/akpanel-php.conf", []byte(`fastcgi_split_path_info ^(.+\.php)(/.*)$;
fastcgi_index index.php;
include fastcgi_params;
fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
fastcgi_param PATH_INFO $fastcgi_path_info;
fastcgi_read_timeout 300;
`), 0644)
}

func (n *NginxService) EnsureDefaultNginxConfig() {
	_ = os.MkdirAll("/var/www/html", 0755)
	_ = os.MkdirAll(n.sitesAvailablePath, 0755)
	_ = os.MkdirAll(n.sitesEnabledPath, 0755)
	n.ensureFastcgiParams()

	sslCert, sslKey := n.ensureFallbackSSL()
	phpSock := n.getActivePHPSocket()

	defaultConf := fmt.Sprintf(`server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    server_name _;
    root /var/www/html;
    index index.php index.html index.htm;

    ssl_certificate %s;
    ssl_certificate_key %s;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

    location /webmail {
        alias /var/www/roundcube;
        index index.php index.html;
        try_files $uri $uri/ /webmail/index.php?$query_string;
        location ~ \.php$ {
            try_files $uri =404;
            include fastcgi_params;
            fastcgi_pass %s;
            fastcgi_param SCRIPT_FILENAME $request_filename;
        }
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

%s
    location ~ /\.ht {
        deny all;
    }
}
`, sslCert, sslKey, phpSock, n.phpFastcgiLocation(phpSock))

	defaultPath := filepath.Join(n.sitesAvailablePath, "default")
	if existing, err := os.ReadFile(defaultPath); err != nil || string(existing) != defaultConf {
		_ = os.WriteFile(defaultPath, []byte(defaultConf), 0644)
	}

	enabledPath := filepath.Join(n.sitesEnabledPath, "default")
	_ = os.Remove(enabledPath)
	_ = os.Symlink(defaultPath, enabledPath)
	// Avoid two default_server blocks (Debian default vs AKpanel).
	_ = os.Remove("/etc/nginx/sites-enabled/000-default")

	if _, err := os.Stat("/var/www/html/index.php"); err != nil {
		_ = WriteWelcomeIndex("/var/www/html/index.php", "AKpanel", "server")
	}

	if err := n.TestConfig(); err == nil {
		_ = n.ReloadNginx()
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

	// 3. Set ownership (skip for client-owned sites — they use user:user + FPM pool)
	if !cfg.SkipOwnershipFix {
		if strings.HasPrefix(cfg.RootPath, paths.UserHomes+"/") {
			if acc := linuxAccountFromPath(cfg.RootPath); acc != "" {
				_ = exec.Command("chown", "-R", acc+":"+acc, cfg.RootPath).Run()
			}
		} else {
			_ = exec.Command("chown", "-R", "www-data:www-data", filepath.Dir(cfg.RootPath)).Run()
		}
	}

	// 4. Handle Server Engines — normalize first to avoid string mismatches
	engine := domain.EngineFromPackage(cfg.ServerEngine)
	if !domain.ProfileNeedsApache(readServerProfileID()) {
		engine = domain.EngineNginx
	}

	switch engine {
	case domain.EngineApache:
		// Nginx front → Apache:8081 (legacy mode, same provisioning as hybrid)
		if err := n.apacheService.CreateApacheVhost(cfg, true); err != nil {
			return err
		}
		return n.createNginxVhost(cfg, true)

	case domain.EngineHybrid, domain.EngineVarnishHybrid:
		// Nginx front → Apache:8081 (.htaccess support)
		// Varnish sits in front of Nginx for varnish_hybrid (handled by VarnishService)
		if err := n.apacheService.CreateApacheVhost(cfg, true); err != nil {
			return err
		}
		return n.createNginxVhost(cfg, true)

	default: // EngineNginx, EngineVarnishNginx
		_ = n.apacheService.EnsureInternalBackend()
		if !domain.ProfileNeedsApache(readServerProfileID()) {
			_ = exec.Command("service", "apache2", "stop").Run()
		}
		_ = n.apacheService.DeleteApacheVhost(cfg.Domain)
		return n.createNginxVhost(cfg, false)
	}
}

func (n *NginxService) createNginxVhost(cfg WebsiteConfig, isHybrid bool) error {
	vhostContent := n.generateVhostConfig(cfg, isHybrid)
	if cfg.OwnerUsername != "" && cfg.OwnerUsername != "root" && cfg.OwnerUsername != "admin" {
		vhostContent = "# akpanel-owner: " + cfg.OwnerUsername + "\n" + vhostContent
	}
	vhostContent = injectNginxHoldIncludes(vhostContent, cfg.OwnerUsername)
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

// UpdateWebsiteRoot regenerates vhost configs with a new document root.
func (n *NginxService) UpdateWebsiteRoot(domain, rootPath string) error {
	cfg := WebsiteConfig{
		Domain:           domain,
		RootPath:         rootPath,
		ServerEngine:     "nginx",
		PHPVersion:       paths.DetectInstalledPHPVersion(""),
		SiteType:         "php",
		SkipOwnershipFix: true,
	}
	return n.CreateWebsite(cfg)
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
	if _, err := os.Stat(indexHtmlPath); os.IsNotExist(err) {
		_ = WriteWelcomeIndex(indexPhpPath, cfg.Domain, cfg.OwnerUsername)
	}
}

func (n *NginxService) panelServerSSLPaths() (string, string, bool) {
	certPath := "/etc/akpanel/ssl/server/fullchain.pem"
	keyPath := "/etc/akpanel/ssl/server/privkey.pem"
	if _, err := os.Stat(certPath); err == nil {
		if _, errKey := os.Stat(keyPath); errKey == nil {
			return certPath, keyPath, true
		}
	}
	return "", "", false
}

func (n *NginxService) ensureFallbackSSL() (string, string) {
	if cert, key, ok := n.panelServerSSLPaths(); ok {
		return cert, key
	}

	certPath := "/etc/ssl/certs/akpanel-selfsigned.crt"
	keyPath := "/etc/ssl/private/akpanel-selfsigned.key"
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		_ = os.MkdirAll("/etc/ssl/certs", 0755)
		_ = os.MkdirAll("/etc/ssl/private", 0700)
		_ = exec.Command("openssl", "req", "-x509", "-nodes", "-days", "3650",
			"-newkey", "rsa:2048",
			"-keyout", keyPath,
			"-out", certPath,
			"-subj", "/C=US/ST=Cloud/L=Host/O=AKpanel/CN=akpanel.local").Run()
	}
	return certPath, keyPath
}

func (n *NginxService) getSSLCertAndKey(domainName string) (string, string) {
	candidates := []string{domainName}
	parts := strings.Split(domainName, ".")
	if len(parts) > 2 {
		candidates = append(candidates, strings.Join(parts[1:], "."))
	}

	for _, name := range candidates {
		if domain.SSLCertsExist(name) {
			return domain.SSLCertPath(name), domain.SSLKeyPath(name)
		}
		legacyCert := fmt.Sprintf("/etc/letsencrypt/live/%s/fullchain.pem", name)
		legacyKey := fmt.Sprintf("/etc/letsencrypt/live/%s/privkey.pem", name)
		if _, err := os.Stat(legacyCert); err == nil {
			if _, errKey := os.Stat(legacyKey); errKey == nil {
				return legacyCert, legacyKey
			}
		}
	}

	return n.ensureFallbackSSL()
}

func (n *NginxService) generateVhostConfig(cfg WebsiteConfig, isHybrid bool) string {
	cfg.PHPVersion = paths.DetectInstalledPHPVersion(cfg.PHPVersion)
	phpSocket := n.resolvePHPSocket(cfg)
	sslCert, sslKey := n.getSSLCertAndKey(cfg.Domain)

	// Hybrid Mode: Nginx caches static assets and proxies PHP requests to Apache on port 8081
	if isHybrid {
		return fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name %s www.%s;
    root %s;

    ssl_certificate %s;
    ssl_certificate_key %s;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    access_log /var/log/nginx/%s.access.log;
    error_log /var/log/nginx/%s.error.log;

%s    # Static files served directly by Nginx with aggressive caching
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
`, cfg.Domain, cfg.Domain, cfg.RootPath, sslCert, sslKey, cfg.Domain, cfg.Domain, acmeChallengeLocation())
	}

	// Reverse Proxy / Node / Python / Go
	if cfg.SiteType == "proxy" {
		return fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name %s www.%s;

    ssl_certificate %s;
    ssl_certificate_key %s;
    ssl_protocols TLSv1.2 TLSv1.3;

    access_log /var/log/nginx/%s.access.log;
    error_log /var/log/nginx/%s.error.log;

%s    location / {
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
`, cfg.Domain, cfg.Domain, sslCert, sslKey, cfg.Domain, cfg.Domain, acmeChallengeLocation(), cfg.ProxyPort)
	}

	// Static / SPA
	if cfg.SiteType == "static" {
		return fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name %s www.%s;
    root %s;

    ssl_certificate %s;
    ssl_certificate_key %s;
    ssl_protocols TLSv1.2 TLSv1.3;

    index index.html index.htm;

    access_log /var/log/nginx/%s.access.log;
    error_log /var/log/nginx/%s.error.log;

%s    location / {
        try_files $uri $uri/ /index.html =404;
    }

    location ~ /\.ht {
        deny all;
    }
}
`, cfg.Domain, cfg.Domain, cfg.RootPath, sslCert, sslKey, cfg.Domain, cfg.Domain, acmeChallengeLocation())
	}

	// Default: Pure Nginx PHP FastCGI
	return fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name %s www.%s;
    root %s;

    ssl_certificate %s;
    ssl_certificate_key %s;
    ssl_protocols TLSv1.2 TLSv1.3;

    index index.php index.html index.htm;

    access_log /var/log/nginx/%s.access.log;
    error_log /var/log/nginx/%s.error.log;

%s    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

%s
    location ~ /\.ht {
        deny all;
    }
}
`, cfg.Domain, cfg.Domain, cfg.RootPath, sslCert, sslKey, cfg.Domain, cfg.Domain, acmeChallengeLocation(), n.phpFastcgiLocation(phpSocket))
}

// CreateProxyVhost writes an nginx vhost that reverse-proxies to a local port with optional extra headers.
func (n *NginxService) CreateProxyVhost(domain string, port int, extraHeaders map[string]string) error {
	sslCert, sslKey := n.getSSLCertAndKey(domain)
	headerLines := ""
	for k, v := range extraHeaders {
		headerLines += fmt.Sprintf("        proxy_set_header %s %s;\n", k, v)
	}
	vhost := fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name %s;

    ssl_certificate %s;
    ssl_certificate_key %s;
    ssl_protocols TLSv1.2 TLSv1.3;

    access_log /var/log/nginx/%s.access.log;
    error_log /var/log/nginx/%s.error.log;

%s    location / {
        proxy_pass http://127.0.0.1:%d;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
%s        proxy_cache_bypass $http_upgrade;
    }
}
`, domain, sslCert, sslKey, domain, domain, acmeChallengeLocation(), port, headerLines)
	return n.writeAndEnableVhost(domain, vhost)
}

// CreateStaticInfoVhost serves a simple informational page for service subdomains (ftp/imap/pop).
func (n *NginxService) CreateStaticInfoVhost(domain, title, bodyHTML string) error {
	sslCert, sslKey := n.getSSLCertAndKey(domain)
	root := fmt.Sprintf("/var/www/sites/_service/%s", domain)
	_ = os.MkdirAll(root, 0755)
	_ = os.WriteFile(filepath.Join(root, "index.html"), []byte(fmt.Sprintf(`<!DOCTYPE html><html><head><title>%s</title></head><body>%s</body></html>`, title, bodyHTML)), 0644)
	vhost := fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name %s;
    root %s;
    ssl_certificate %s;
    ssl_certificate_key %s;
    index index.html;
%s    location / { try_files $uri $uri/ =404; }
}
`, domain, root, sslCert, sslKey, acmeChallengeLocation())
	return n.writeAndEnableVhost(domain, vhost)
}

func (n *NginxService) writeAndEnableVhost(domain, content string) error {
	availableFile := filepath.Join(n.sitesAvailablePath, fmt.Sprintf("%s.conf", domain))
	enabledFile := filepath.Join(n.sitesEnabledPath, fmt.Sprintf("%s.conf", domain))
	if err := os.WriteFile(availableFile, []byte(content), 0644); err != nil {
		return err
	}
	_ = os.Remove(enabledFile)
	if err := os.Symlink(availableFile, enabledFile); err != nil {
		return err
	}
	if err := n.TestConfig(); err != nil {
		return err
	}
	return n.ReloadNginx()
}

// EnsurePanelHostnameVhost creates/updates nginx :443 vhost for the panel hostname using the server SSL cert.
func (n *NginxService) EnsurePanelHostnameVhost(hostname string) error {
	hostname = strings.ToLower(strings.TrimSpace(hostname))
	if hostname == "" || hostname == "localhost" {
		return nil
	}

	certPath, keyPath, ok := n.panelServerSSLPaths()
	if !ok {
		certPath, keyPath = n.getSSLCertAndKey(hostname)
	}

	conf := fmt.Sprintf(`# AKpanel Panel Hostname — auto-managed, do not edit manually
server {
    listen 80;
    listen [::]:80;
    server_name %s;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name %s;

    ssl_certificate %s;
    ssl_certificate_key %s;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

    location / {
        return 302 https://$host:2087$request_uri;
    }
}
`, hostname, hostname, certPath, keyPath)

	safeName := strings.ReplaceAll(hostname, ".", "_")
	availablePath := filepath.Join(n.sitesAvailablePath, "akpanel-hostname-"+safeName+".conf")
	if err := os.WriteFile(availablePath, []byte(conf), 0644); err != nil {
		return err
	}

	enabledPath := filepath.Join(n.sitesEnabledPath, "akpanel-hostname-"+safeName+".conf")
	_ = os.Remove(enabledPath)
	if err := os.Symlink(availablePath, enabledPath); err != nil {
		return err
	}

	if err := n.TestConfig(); err != nil {
		return err
	}
	return n.ReloadNginx()
}

func (n *NginxService) phpFastcgiPass() string {
	return n.getActivePHPSocket()
}

func (n *NginxService) roundcubePHPLocations() string {
	sock := n.phpFastcgiPass()
	return fmt.Sprintf(`    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

%s
    location ~ /\.(ht|git) {
        deny all;
    }
`, n.phpFastcgiLocationProxied(sock))
}

// EnsureRoundcubeListener serves Roundcube on 127.0.0.1:8086 for the panel /webmail proxy.
func (n *NginxService) EnsureRoundcubeListener() error {
	rcRoot := paths.RoundcubeWebRoot()
	_ = os.MkdirAll(rcRoot, 0755)
	conf := fmt.Sprintf(`# AKpanel internal Roundcube (panel /webmail reverse proxy)
server {
    listen 127.0.0.1:8086;
    server_name _;
    root %s;
    index index.php index.html;

%s
}
`, rcRoot, n.roundcubePHPLocations())

	availablePath := filepath.Join(n.sitesAvailablePath, "akpanel-roundcube-internal.conf")
	if existing, err := os.ReadFile(availablePath); err == nil && string(existing) == conf {
		enabledPath := filepath.Join(n.sitesEnabledPath, "akpanel-roundcube-internal.conf")
		if _, err := os.Lstat(enabledPath); err == nil {
			return nil
		}
	}
	if err := os.WriteFile(availablePath, []byte(conf), 0644); err != nil {
		return err
	}
	enabledPath := filepath.Join(n.sitesEnabledPath, "akpanel-roundcube-internal.conf")
	_ = os.Remove(enabledPath)
	if err := os.Symlink(availablePath, enabledPath); err != nil {
		return err
	}
	if err := n.TestConfig(); err != nil {
		return err
	}
	return n.ReloadNginx()
}

// EnsurePhpMyAdminListener serves phpMyAdmin on 127.0.0.1:8085 for the panel reverse proxy.
func (n *NginxService) EnsurePhpMyAdminListener() error {
	pmaRoot := "/usr/share/phpmyadmin"
	if _, err := os.Stat(pmaRoot); err != nil {
		pmaRoot = "/usr/share/phpMyAdmin"
	}
	_ = os.MkdirAll(pmaRoot, 0755)
	sock := n.phpFastcgiPass()
	conf := fmt.Sprintf(`# AKpanel internal phpMyAdmin (panel /phpmyadmin reverse proxy)
server {
    listen 127.0.0.1:8085;
    server_name _;
    root %s;
    index index.php index.html;

    rewrite ^/phpmyadmin(/.*)$ $1 last;
    rewrite ^/phpmyadmin$ /index.php last;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

%s
    location ~ /\.(ht|git) {
        deny all;
    }
}
`, pmaRoot, n.phpFastcgiLocationProxied(sock))

	availablePath := filepath.Join(n.sitesAvailablePath, "akpanel-pma-internal.conf")
	if existing, err := os.ReadFile(availablePath); err == nil && string(existing) == conf {
		enabledPath := filepath.Join(n.sitesEnabledPath, "akpanel-pma-internal.conf")
		if _, err := os.Lstat(enabledPath); err == nil {
			return nil
		}
	}
	if err := os.WriteFile(availablePath, []byte(conf), 0644); err != nil {
		return err
	}
	enabledPath := filepath.Join(n.sitesEnabledPath, "akpanel-pma-internal.conf")
	_ = os.Remove(enabledPath)
	if err := os.Symlink(availablePath, enabledPath); err != nil {
		return err
	}
	if err := n.TestConfig(); err != nil {
		return err
	}
	return n.ReloadNginx()
}

// CreateWebmailVhost serves Roundcube over HTTP/HTTPS for webmail.{domain}.
func (n *NginxService) CreateWebmailVhost(host string) error {
	sslCert, sslKey := n.getSSLCertAndKey(host)
	vhost := fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name %s;
    root %s;
    index index.php index.html;

    ssl_certificate %s;
    ssl_certificate_key %s;
    ssl_protocols TLSv1.2 TLSv1.3;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

%s
}
`, host, paths.RoundcubeWebRoot(), sslCert, sslKey, n.roundcubePHPLocations())
	return n.writeAndEnableVhost(host, vhost)
}

// CreateClientPanelVhost proxies cpanel.{domain} to the tenant portal (not root WHM).
func (n *NginxService) CreateClientPanelVhost(host string) error {
	sslCert, sslKey := n.getSSLCertAndKey(host)
	vhost := fmt.Sprintf(`server {
    listen 80;
    listen [::]:80;
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name %s;

    ssl_certificate %s;
    ssl_certificate_key %s;
    ssl_protocols TLSv1.2 TLSv1.3;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

    location / {
        proxy_pass http://127.0.0.1:2088;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port 2083;
        proxy_set_header X-Panel-Scope client;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 10s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
`, host, sslCert, sslKey)
	return n.writeAndEnableVhost(host, vhost)
}

// RepairPanelServiceVhosts rewrites existing webmail.* / cpanel.* vhosts to the current templates.
func (n *NginxService) RepairPanelServiceVhosts() {
	_ = n.EnsureRoundcubeListener()
	_ = n.EnsurePhpMyAdminListener()
	entries, err := os.ReadDir(n.sitesAvailablePath)
	if err != nil {
		return
	}
	for _, e := range entries {
		name := e.Name()
		if !strings.HasSuffix(name, ".conf") {
			continue
		}
		host := strings.TrimSuffix(name, ".conf")
		content, _ := os.ReadFile(filepath.Join(n.sitesAvailablePath, name))
		body := string(content)
		if strings.HasPrefix(host, "webmail.") {
			if strings.Contains(body, "proxy_pass http://127.0.0.1:8086") || !strings.Contains(body, paths.RoundcubeWebRoot()) {
				_ = n.CreateWebmailVhost(host)
			}
		}
		if strings.HasPrefix(host, "cpanel.") {
			if !strings.Contains(body, "X-Panel-Scope client") || !strings.Contains(body, "X-Forwarded-Port 2083") {
				_ = n.CreateClientPanelVhost(host)
			}
		}
	}
}
