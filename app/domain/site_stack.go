package domain

import (
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
)

// Backend is the daemon that runs a PHP site's code.
type Backend string

const (
	BackendApache Backend = "apache" // Apache vhost (.htaccess) with an Apache PHP handler
	BackendNginx  Backend = "nginx"  // Nginx server block with fastcgi_pass to PHP-FPM
)

// PHPHandler is how Apache executes PHP. Nginx always uses FPM.
type PHPHandler string

const (
	HandlerFPM PHPHandler = "fpm" // mod_proxy_fcgi → the account's PHP-FPM pool
	HandlerCGI PHPHandler = "cgi" // mod_fcgid + suexec → php-cgi as the account user
)

// Site types (websites.site_type).
const (
	SiteTypePHP    = "php"
	SiteTypeStatic = "static"
	SiteTypeProxy  = "proxy"
)

// Varnish preference stored per site: "" follows the mode default.
const (
	VarnishDefault = ""
	VarnishOn      = "on"
	VarnishOff     = "off"
)

// SiteStack is what a site asked for (stored in the websites table). Effective values are
// computed by ResolveStack against the current Mode; the stored request is never rewritten
// by a mode switch, so switching back restores every domain's choice.
type SiteStack struct {
	SiteType   string     `json:"site_type"`
	Backend    Backend    `json:"backend"`
	PHPHandler PHPHandler `json:"php_handler"`
	Varnish    string     `json:"varnish"`
	ProxyPort  int        `json:"proxy_port"`
	ProxyHost  string     `json:"proxy_host,omitempty"` // proxy sites: "" = 127.0.0.1
}

// EffectiveStack is what actually gets rendered.
type EffectiveStack struct {
	Mode       Mode       `json:"mode"`
	SiteType   string     `json:"site_type"`
	Backend    Backend    `json:"backend"`     // who runs PHP (php sites) or who serves the site
	PHPHandler PHPHandler `json:"php_handler"` // only meaningful when Backend == apache
	Varnish    bool       `json:"varnish"`
	ProxyPort  int        `json:"proxy_port"`
	ProxyHost  string     `json:"proxy_host,omitempty"`
	Notes      []string   `json:"notes,omitempty"`
}

// ResolveStack applies the mode's rules to a site's request.
// cgiAvailable reports whether mod_fcgid/suexec/php-cgi are installed for the site's version.
func ResolveStack(mode Mode, req SiteStack, cgiAvailable bool) EffectiveStack {
	eff := EffectiveStack{Mode: mode, SiteType: normalizeSiteType(req.SiteType), ProxyPort: req.ProxyPort}
	if eff.SiteType == SiteTypeProxy {
		eff.ProxyHost = ProxyHostOrDefault(req.ProxyHost)
	}

	// Static and proxy sites are served by whoever owns the public ports: putting a second
	// web server behind them adds a hop and nothing else.
	if eff.SiteType != SiteTypePHP {
		eff.Backend = mode.Front()
	} else {
		eff.Backend = req.Backend
		if eff.Backend == "" {
			eff.Backend = mode.DefaultBackend()
		} else if !mode.Allows(eff.Backend) {
			eff.Notes = append(eff.Notes, "backend "+string(req.Backend)+" is not available in mode "+string(mode)+"; using "+string(mode.DefaultBackend()))
			eff.Backend = mode.DefaultBackend()
		}
	}

	if eff.Backend == BackendApache && eff.SiteType == SiteTypePHP {
		eff.PHPHandler = HandlerFPM
		if req.PHPHandler == HandlerCGI {
			if cgiAvailable {
				eff.PHPHandler = HandlerCGI
			} else {
				eff.Notes = append(eff.Notes, "php-cgi handler is not installed; using php-fpm")
			}
		}
	}

	if mode.HasVarnish() && eff.SiteType != SiteTypeProxy {
		switch req.Varnish {
		case VarnishOn:
			eff.Varnish = true
		case VarnishOff:
			eff.Varnish = false
		default:
			eff.Varnish = mode.VarnishDefault()
		}
	}
	return eff
}

func normalizeSiteType(t string) string {
	switch strings.ToLower(strings.TrimSpace(t)) {
	case SiteTypeStatic:
		return SiteTypeStatic
	case SiteTypeProxy:
		return SiteTypeProxy
	default:
		return SiteTypePHP
	}
}

// ParseBackend accepts the current values and every legacy engine string
// (websites.server_engine, packages.default_web_engine). "" means "mode default".
func ParseBackend(raw string) (Backend, string) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "default", "auto":
		return "", VarnishDefault
	case "nginx", "nginx_fpm", "nginx_phpfpm", "nginx-phpfpm":
		return BackendNginx, VarnishDefault
	case "apache", "apache_phpfpm", "apache-phpfpm", "hybrid", "nginx+apache", "hybrid_nginx_apache", "nginx_apache":
		return BackendApache, VarnishDefault
	case "varnish_hybrid", "varnish+nginx+apache", "varnish_nginx_apache":
		return BackendApache, VarnishOn
	case "varnish_nginx", "varnish+nginx", "varnish_nginx_phpfpm", "varnish+nginx+phpfpm":
		return BackendNginx, VarnishOn
	}
	return "", VarnishDefault
}

// ParsePHPHandler accepts fpm/cgi ("" = fpm).
func ParsePHPHandler(raw string) PHPHandler {
	if strings.ToLower(strings.TrimSpace(raw)) == string(HandlerCGI) {
		return HandlerCGI
	}
	return HandlerFPM
}

// ParseVarnish accepts on/off/"" plus booleans.
func ParseVarnish(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "on", "true", "1", "yes":
		return VarnishOn
	case "off", "false", "0", "no":
		return VarnishOff
	}
	return VarnishDefault
}

// DefaultProxyHost is where proxy sites go when no host is set.
const DefaultProxyHost = "127.0.0.1"

// ProxyHostOrDefault trims host and falls back to DefaultProxyHost.
func ProxyHostOrDefault(host string) string {
	host = strings.TrimSpace(host)
	if host == "" {
		return DefaultProxyHost
	}
	return host
}

var proxyHostname = regexp.MustCompile(`^[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,62}[A-Za-z0-9])?)*$`)

// ValidateProxyTarget checks a proxy site's upstream (an IP address or a host name, and a port).
func ValidateProxyTarget(host string, port int) error {
	if port < 1 || port > 65535 {
		return fmt.Errorf("proxy port must be 1-65535")
	}
	host = strings.TrimSpace(host)
	if host == "" {
		return nil
	}
	if net.ParseIP(strings.Trim(host, "[]")) != nil {
		return nil
	}
	if len(host) > 253 || !proxyHostname.MatchString(host) {
		return fmt.Errorf("proxy host must be an IP address or a host name")
	}
	return nil
}

// ProxyAddr is host:port as nginx and Apache want it (IPv6 in brackets).
func ProxyAddr(host string, port int) string {
	return net.JoinHostPort(strings.Trim(ProxyHostOrDefault(host), "[]"), strconv.Itoa(port))
}
