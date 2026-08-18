package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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
		var fileNames []string
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
	return os.WriteFile(path, []byte(content), 0644)
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
