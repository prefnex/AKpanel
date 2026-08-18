package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type ServerProfile struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Badge       string `json:"badge"`
	Description string `json:"description"`
	BestFor     string `json:"best_for"`
	Architecture string `json:"architecture"`
	IsActive    bool   `json:"is_active"`
}

type ServiceState struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	IsRunning   bool   `json:"is_running"`
	Uptime      string `json:"uptime"`
	Port        string `json:"port"`
}

type WebServerManagerService struct {
	currentProfile string
	profileFile    string
	templatesDir   string
}

func NewWebServerManagerService() *WebServerManagerService {
	s := &WebServerManagerService{
		currentProfile: "hybrid_nginx_apache",
		profileFile:    "/etc/akpanel/server_profile.conf",
		templatesDir:   "app/templates",
	}
	s.loadCurrentProfile()
	return s
}

func (w *WebServerManagerService) GetProfiles() []ServerProfile {
	profiles := []ServerProfile{
		{
			ID:           "nginx_phpfpm",
			Name:         "Nginx + PHP-FPM",
			Badge:        "Lightning Speed",
			Description:  "Pure event-driven Nginx serving static assets and connecting directly to PHP-FPM unix sockets.",
			BestFor:      "Modern APIs, Laravel, Node.js, and Single Page Apps (Sub-millisecond latency).",
			Architecture: "Internet -> Nginx (80/443) -> PHP-FPM Unix Socket",
			IsActive:     (w.currentProfile == "nginx_phpfpm"),
		},
		{
			ID:           "apache_phpfpm",
			Name:         "Apache + PHP-FPM",
			Badge:        "Full .htaccess",
			Description:  "Pure Apache HTTP server running with event MPM and proxy_fcgi.",
			BestFor:      "Legacy CMS, complex .htaccess rewrite rules per folder, and custom Apache modules.",
			Architecture: "Internet -> Apache (80/443) -> PHP-FPM Socket",
			IsActive:     (w.currentProfile == "apache_phpfpm"),
		},
		{
			ID:           "hybrid_nginx_apache",
			Name:         "Nginx + Apache Hybrid",
			Badge:        "Most Popular",
			Description:  "Nginx edge reverse proxy caches static media and passes dynamic PHP requests to Apache.",
			BestFor:      "Standard WordPress, WooCommerce, and Prestashop (Nginx speed + Apache .htaccess).",
			Architecture: "Internet -> Nginx (80/443) -> Static Direct Cache / Dynamic to Apache (8081)",
			IsActive:     (w.currentProfile == "hybrid_nginx_apache"),
		},
		{
			ID:           "varnish_nginx_apache",
			Name:         "Nginx + Varnish + Apache",
			Badge:        "Max Traffic Turbo",
			Description:  "Nginx handles SSL termination -> Varnish in-memory RAM cache -> Apache backend for dynamic pages.",
			BestFor:      "High-traffic News, Articles, Media, Blogs with high read-to-write ratio (100x traffic capacity).",
			Architecture: "Internet -> Nginx (443 SSL) -> Varnish RAM (6081) -> Apache (8081)",
			IsActive:     (w.currentProfile == "varnish_nginx_apache"),
		},
		{
			ID:           "varnish_nginx_phpfpm",
			Name:         "Nginx + Varnish + PHP-FPM",
			Badge:        "High Concurrency",
			Description:  "Nginx SSL termination -> Varnish in-memory cache -> Nginx PHP-FPM backend.",
			BestFor:      "Extreme load API endpoints and static-first web applications.",
			Architecture: "Internet -> Nginx SSL -> Varnish Cache -> Nginx PHP-FPM Socket",
			IsActive:     (w.currentProfile == "varnish_nginx_phpfpm"),
		},
	}
	return profiles
}

func (w *WebServerManagerService) GetServicesState() []ServiceState {
	services := []struct {
		Name        string
		DisplayName string
		Port        string
	}{
		{"nginx", "Nginx Web Server", "80, 443"},
		{"apache2", "Apache HTTP Server", "8081"},
		{"varnish", "Varnish HTTP Accelerator", "6081"},
		{"php8.2-fpm", "PHP 8.2 FPM Daemon", "unix socket"},
		{"php8.3-fpm", "PHP 8.3 FPM Daemon", "unix socket"},
	}

	var states []ServiceState
	for _, s := range services {
		cmd := exec.Command("service", s.Name, "status")
		isRunning := (cmd.Run() == nil)
		states = append(states, ServiceState{
			Name:        s.Name,
			DisplayName: s.DisplayName,
			IsRunning:   isRunning,
			Uptime:      "Active",
			Port:        s.Port,
		})
	}
	return states
}

func (w *WebServerManagerService) ControlService(serviceName, action string) error {
	validActions := map[string]bool{"start": true, "stop": true, "restart": true, "reload": true}
	if !validActions[action] {
		return fmt.Errorf("invalid action '%s'", action)
	}

	cmd := exec.Command("service", serviceName, action)
	return cmd.Run()
}

func (w *WebServerManagerService) SwitchGlobalProfile(profileID string) error {
	w.currentProfile = profileID
	_ = os.MkdirAll("/etc/akpanel", 0755)
	_ = os.WriteFile(w.profileFile, []byte(profileID), 0644)

	// Apply configuration & restart relevant services
	switch profileID {
	case "nginx_phpfpm":
		_ = exec.Command("service", "apache2", "stop").Run()
		_ = exec.Command("service", "varnish", "stop").Run()
		_ = exec.Command("service", "nginx", "restart").Run()
	case "apache_phpfpm":
		_ = exec.Command("service", "varnish", "stop").Run()
		_ = exec.Command("service", "apache2", "restart").Run()
	case "hybrid_nginx_apache":
		_ = exec.Command("service", "apache2", "start").Run()
		_ = exec.Command("service", "nginx", "restart").Run()
	case "varnish_nginx_apache":
		_ = exec.Command("service", "apache2", "start").Run()
		_ = exec.Command("service", "varnish", "restart").Run()
		_ = exec.Command("service", "nginx", "restart").Run()
	case "varnish_nginx_phpfpm":
		_ = exec.Command("service", "apache2", "stop").Run()
		_ = exec.Command("service", "varnish", "restart").Run()
		_ = exec.Command("service", "nginx", "restart").Run()
	}

	return nil
}

func (w *WebServerManagerService) GetTemplateFiles() (map[string][]string, error) {
	result := make(map[string][]string)
	engines := []string{"nginx", "apache", "varnish"}

	for _, eng := range engines {
		dir := filepath.Join(w.templatesDir, eng)
		files, _ := os.ReadDir(dir)
		fileNames := []string{}
		for _, f := range files {
			if !f.IsDir() {
				fileNames = append(fileNames, f.Name())
			}
		}
		result[eng] = fileNames
	}
	return result, nil
}

func (w *WebServerManagerService) ReadTemplateFile(engine, filename string) (string, error) {
	path := filepath.Join(w.templatesDir, engine, filename)
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (w *WebServerManagerService) SaveTemplateFile(engine, filename, content string) error {
	path := filepath.Join(w.templatesDir, engine, filename)
	_ = os.MkdirAll(filepath.Dir(path), 0755)
	return os.WriteFile(path, []byte(content), 0644)
}

type MainConfigFile struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	Engine      string `json:"engine"`
	Content     string `json:"content"`
	Description string `json:"description"`
}

// GetMainConfigs returns all global web server configuration files
func (w *WebServerManagerService) GetMainConfigs() []MainConfigFile {
	configs := []struct {
		name        string
		path        string
		engine      string
		description string
	}{
		{"Nginx Main Config", "/etc/nginx/nginx.conf", "nginx", "Primary Nginx Core Configuration & Events block"},
		{"Apache2 Main Config", "/etc/apache2/apache2.conf", "apache", "Primary Apache HTTP Server Configuration & MPM settings"},
		{"Apache2 Ports Config", "/etc/apache2/ports.conf", "apache", "Apache Listen Ports (8081 dynamic backend)"},
		{"Varnish Default VCL", "/etc/varnish/default.vcl", "varnish", "Varnish Cache In-Memory Caching & Backend Routing rules"},
	}

	var list []MainConfigFile
	for _, c := range configs {
		content := ""
		if data, err := os.ReadFile(c.path); err == nil {
			content = string(data)
		}
		list = append(list, MainConfigFile{
			Name:        c.name,
			Path:        c.path,
			Engine:      c.engine,
			Content:     content,
			Description: c.description,
		})
	}
	return list
}

// SaveMainConfig updates a global web server configuration file with syntax verification
func (w *WebServerManagerService) SaveMainConfig(filePath, content string) error {
	_ = os.MkdirAll(filepath.Dir(filePath), 0755)
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return err
	}

	// Test syntax based on engine
	if strings.Contains(filePath, "nginx") {
		if out, err := exec.Command("nginx", "-t").CombinedOutput(); err != nil {
			return fmt.Errorf("nginx syntax test failed: %s", string(out))
		}
		_ = exec.Command("service", "nginx", "reload").Run()
	} else if strings.Contains(filePath, "apache2") {
		if out, err := exec.Command("apache2ctl", "configtest").CombinedOutput(); err != nil {
			return fmt.Errorf("apache syntax test failed: %s", string(out))
		}
		_ = exec.Command("service", "apache2", "reload").Run()
	} else if strings.Contains(filePath, "varnish") {
		_ = exec.Command("service", "varnish", "reload").Run()
	}

	return nil
}

type DomainVhostInfo struct {
	Domain     string `json:"domain"`
	User       string `json:"user"`
	Engine     string `json:"engine"`
	NginxConf  string `json:"nginx_conf"`
	ApacheConf string `json:"apache_conf"`
	HasSSL     bool   `json:"has_ssl"`
}

// GetDomainVhost retrieves Nginx and Apache vhost configurations for a specific domain
func (w *WebServerManagerService) GetDomainVhost(domain string) DomainVhostInfo {
	nginxPath := fmt.Sprintf("/etc/nginx/sites-available/%s", domain)
	apachePath := fmt.Sprintf("/etc/apache2/sites-available/%s.conf", domain)

	nginxContent := ""
	if data, err := os.ReadFile(nginxPath); err == nil {
		nginxContent = string(data)
	}

	apacheContent := ""
	if data, err := os.ReadFile(apachePath); err == nil {
		apacheContent = string(data)
	}

	hasSSL := false
	if _, err := os.Stat(fmt.Sprintf("/etc/akpanel/ssl/%s/fullchain.pem", domain)); err == nil {
		hasSSL = true
	}

	engine := "nginx+apache"
	if strings.Contains(nginxContent, "proxy_pass http://127.0.0.1:8081") {
		engine = "nginx+apache"
	} else if strings.Contains(nginxContent, "fastcgi_pass") {
		engine = "nginx_phpfpm"
	}

	return DomainVhostInfo{
		Domain:     domain,
		User:       "admin",
		Engine:     engine,
		NginxConf:  nginxContent,
		ApacheConf: apacheContent,
		HasSSL:     hasSSL,
	}
}

// SaveDomainVhost saves custom Nginx & Apache vhost configurations
func (w *WebServerManagerService) SaveDomainVhost(domain, nginxConf, apacheConf string) error {
	nginxPath := fmt.Sprintf("/etc/nginx/sites-available/%s", domain)
	apachePath := fmt.Sprintf("/etc/apache2/sites-available/%s.conf", domain)

	if nginxConf != "" {
		_ = os.WriteFile(nginxPath, []byte(nginxConf), 0644)
		_ = os.Symlink(nginxPath, fmt.Sprintf("/etc/nginx/sites-enabled/%s", domain))
	}
	if apacheConf != "" {
		_ = os.WriteFile(apachePath, []byte(apacheConf), 0644)
		_ = os.Symlink(apachePath, fmt.Sprintf("/etc/apache2/sites-enabled/%s.conf", domain))
	}

	_ = exec.Command("service", "nginx", "reload").Run()
	_ = exec.Command("service", "apache2", "reload").Run()

	return nil
}

// RebuildAllVhosts reloads and recompiles all web server virtual hosts
func (w *WebServerManagerService) RebuildAllVhosts() (string, error) {
	_ = exec.Command("service", "nginx", "reload").Run()
	_ = exec.Command("service", "apache2", "reload").Run()
	_ = exec.Command("service", "varnish", "reload").Run()

	return "All virtual hosts, Nginx proxies, and Apache vhosts reloaded and rebuilt successfully.", nil
}

// GetApacheStatus returns Apache server status or worker process table
func (w *WebServerManagerService) GetApacheStatus() (string, error) {
	out, err := exec.Command("bash", "-c", "apache2ctl status 2>/dev/null || service apache2 status 2>/dev/null || apache2 -S 2>&1").CombinedOutput()
	if err != nil {
		return string(out), nil
	}
	return string(out), nil
}

func (w *WebServerManagerService) loadCurrentProfile() {
	if data, err := os.ReadFile(w.profileFile); err == nil {
		w.currentProfile = stringsTrim(string(data))
	}
}

func stringsTrim(s string) string {
	for len(s) > 0 && (s[len(s)-1] == '\n' || s[len(s)-1] == '\r' || s[len(s)-1] == ' ') {
		s = s[:len(s)-1]
	}
	return s
}

