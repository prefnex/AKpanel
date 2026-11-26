package domain

import (
	"fmt"
	"strings"
)

// Mode is the server-wide web server layout stored in /etc/akpanel/server_profile.conf.
// It decides which daemons run, who owns the public ports and which per-site choices are
// allowed. It is the SINGLE source of truth — see SiteStack for the per-domain side.
type Mode string

const (
	ModeApache             Mode = "apache"               // Apache :80/:443
	ModeNginx              Mode = "nginx"                // Nginx :80/:443 + PHP-FPM
	ModeNginxApache        Mode = "nginx_apache"         // Nginx → Apache 127.0.0.1:8081
	ModeNginxVarnish       Mode = "nginx_varnish"        // Nginx → Varnish 127.0.0.1:6081 → Nginx 127.0.0.1:8080
	ModeNginxVarnishApache Mode = "nginx_varnish_apache" // Nginx → Varnish:6081 → Apache:8081
)

// Internal ports (loopback only).
const (
	ApacheBackendPort   = 8081
	NginxBackendPort    = 8080
	VarnishListenPort   = 6081
	ApacheBackendAddr   = "127.0.0.1:8081"
	NginxBackendAddr    = "127.0.0.1:8080"
	VarnishListenAddr   = "127.0.0.1:6081"
	DefaultModeFallback = ModeNginx
)

// Modes lists every supported mode in display order.
var Modes = []Mode{ModeApache, ModeNginx, ModeNginxApache, ModeNginxVarnish, ModeNginxVarnishApache}

// legacyModes maps pre-2026-11 profile IDs to modes.
var legacyModes = map[string]Mode{
	"nginx_phpfpm":         ModeNginx,
	"apache_phpfpm":        ModeApache,
	"hybrid_nginx_apache":  ModeNginxApache,
	"varnish_nginx_apache": ModeNginxVarnishApache,
	"varnish_nginx_phpfpm": ModeNginxVarnish,
}

// ParseMode accepts current and legacy IDs.
func ParseMode(raw string) (Mode, error) {
	raw = strings.ToLower(strings.TrimSpace(raw))
	for _, m := range Modes {
		if string(m) == raw {
			return m, nil
		}
	}
	if m, ok := legacyModes[raw]; ok {
		return m, nil
	}
	return DefaultModeFallback, fmt.Errorf("unknown web server mode %q", raw)
}

// NormalizeMode is ParseMode without the error (unknown → nginx).
func NormalizeMode(raw string) Mode {
	m, _ := ParseMode(raw)
	return m
}

func (m Mode) HasNginx() bool { return m != ModeApache }
func (m Mode) HasApache() bool {
	return m == ModeApache || m == ModeNginxApache || m == ModeNginxVarnishApache
}
func (m Mode) HasVarnish() bool { return m == ModeNginxVarnish || m == ModeNginxVarnishApache }

// Front is the daemon that owns :80/:443.
func (m Mode) Front() Backend {
	if m == ModeApache {
		return BackendApache
	}
	return BackendNginx
}

// AllowedBackends lists who may run a PHP site's code in this mode.
func (m Mode) AllowedBackends() []Backend {
	switch m {
	case ModeApache:
		return []Backend{BackendApache}
	case ModeNginx, ModeNginxVarnish:
		return []Backend{BackendNginx}
	default:
		return []Backend{BackendApache, BackendNginx}
	}
}

// DefaultBackend is used when a site asked for nothing (or for something not allowed).
func (m Mode) DefaultBackend() Backend {
	if m.HasApache() {
		return BackendApache
	}
	return BackendNginx
}

// VarnishDefault: Nginx+Varnish caches every domain by default; Nginx+Varnish+Apache
// serves through Apache directly unless a domain opts in.
func (m Mode) VarnishDefault() bool { return m == ModeNginxVarnish }

func (m Mode) Allows(b Backend) bool {
	for _, a := range m.AllowedBackends() {
		if a == b {
			return true
		}
	}
	return false
}

// ModeInfo describes a mode for the UI.
type ModeInfo struct {
	ID             Mode      `json:"id"`
	Title          string    `json:"title"`
	Description    string    `json:"description"`
	Ports          []string  `json:"ports"`
	Flow           []string  `json:"flow"`
	Backends       []Backend `json:"backends"`
	Handlers       []string  `json:"handlers"`
	HasVarnish     bool      `json:"has_varnish"`
	VarnishDefault bool      `json:"varnish_default"`
}

func (m Mode) Info() ModeInfo {
	info := ModeInfo{ID: m, Backends: m.AllowedBackends(), HasVarnish: m.HasVarnish(), VarnishDefault: m.VarnishDefault()}
	switch m {
	case ModeApache:
		info.Title = "Apache only"
		info.Description = "Apache serves everything itself, including TLS. PHP per site through PHP-FPM or CGI (suexec), .htaccess fully supported."
		info.Ports = []string{"Apache: 80, 443"}
		info.Flow = []string{"HTTP/HTTPS → Apache (80/443)"}
		info.Handlers = []string{"apache: php-fpm, php-cgi (suexec)", "proxy"}
	case ModeNginx:
		info.Title = "Nginx only"
		info.Description = "Nginx with PHP-FPM. Fastest for PHP apps that do not need .htaccess; also a reverse proxy for Node.js, Python, Go."
		info.Ports = []string{"Nginx: 80, 443"}
		info.Flow = []string{"HTTP/HTTPS → Nginx (80/443) → PHP-FPM"}
		info.Handlers = []string{"nginx: php-fpm", "proxy", "static"}
	case ModeNginxApache:
		info.Title = "Nginx & Apache"
		info.Description = "Nginx in front (TLS, static files), Apache behind it for .htaccess. Each domain can also run on Nginx + PHP-FPM directly."
		info.Ports = []string{"Nginx: 80, 443", "Apache: 127.0.0.1:8081"}
		info.Flow = []string{"HTTP/HTTPS → Nginx (80/443) → Apache (8081)"}
		info.Handlers = []string{"apache: php-fpm, php-cgi (suexec)", "nginx: php-fpm", "proxy", "static"}
	case ModeNginxVarnish:
		info.Title = "Nginx & Varnish"
		info.Description = "Nginx terminates TLS, Varnish caches, Nginx + PHP-FPM generates pages. Varnish is on for every domain by default and can be turned off per domain."
		info.Ports = []string{"Nginx: 80, 443", "Varnish: 127.0.0.1:6081", "Nginx backend: 127.0.0.1:8080"}
		info.Flow = []string{"HTTP/HTTPS → Nginx (80/443) → Varnish (6081) → Nginx (8080) → PHP-FPM"}
		info.Handlers = []string{"nginx: php-fpm", "proxy", "static"}
	case ModeNginxVarnishApache:
		info.Title = "Nginx & Varnish & Apache"
		info.Description = "Nginx in front, Apache behind it for every domain. Varnish cache can be turned on per domain."
		info.Ports = []string{"Nginx: 80, 443", "Varnish: 127.0.0.1:6081", "Apache: 127.0.0.1:8081"}
		info.Flow = []string{"HTTP/HTTPS → Nginx (80/443) → Varnish (6081) → Apache (8081)", "Varnish off: Nginx → Apache (8081)"}
		info.Handlers = []string{"apache: php-fpm, php-cgi (suexec)", "nginx: php-fpm", "proxy", "static", "varnish cache per domain"}
	}
	return info
}
