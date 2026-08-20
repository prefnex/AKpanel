// Package domain contains shared domain types and constants for AKpanel.
// This is the SINGLE source of truth for WebEngine values —
// do NOT use raw string literals elsewhere.
package domain

import (
	"fmt"
	"os"
	"strings"
)

// WebEngine represents the web server stack for a hosted site.
// These are the canonical internal values used across all services.
type WebEngine string

const (
	// EngineNginx — Pure Nginx + PHP-FPM (no Apache, no .htaccess)
	EngineNginx WebEngine = "nginx"

	// EngineApache — Nginx front → Apache:8081 (legacy, same as hybrid)
	EngineApache WebEngine = "apache"

	// EngineHybrid — Nginx front → Apache:8081 (.htaccess support)
	EngineHybrid WebEngine = "hybrid"

	// EngineVarnishHybrid — Nginx:443 → Varnish:6081 → Apache:8081
	EngineVarnishHybrid WebEngine = "varnish_hybrid"

	// EngineVarnishNginx — Nginx → Varnish → Nginx+PHP-FPM
	EngineVarnishNginx WebEngine = "varnish_nginx"
)

// NormalizeEngine converts any legacy or alternate engine string to the canonical WebEngine.
// Maps package-style names (e.g. "nginx+apache", "varnish+nginx+apache")
// to the canonical internal names used by NginxService / provisioning.
func NormalizeEngine(raw string) (WebEngine, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "nginx", "nginx_phpfpm", "nginx-phpfpm":
		return EngineNginx, nil
	case "apache", "apache_phpfpm", "apache-phpfpm":
		return EngineApache, nil
	case "hybrid", "nginx+apache", "hybrid_nginx_apache", "nginx_apache":
		return EngineHybrid, nil
	case "varnish_hybrid", "varnish+nginx+apache", "varnish_nginx_apache":
		return EngineVarnishHybrid, nil
	case "varnish_nginx", "varnish+nginx", "varnish_nginx_phpfpm", "varnish+nginx+phpfpm":
		return EngineVarnishNginx, nil
	default:
		return EngineNginx, fmt.Errorf("unknown engine %q — defaulting to nginx", raw)
	}
}

// EngineFromPackage converts a HostingPackage.DefaultWebEngine string to WebEngine.
// Packages use legacy names like "nginx+apache"; this returns the canonical form.
func EngineFromPackage(pkgDefault string) WebEngine {
	e, _ := NormalizeEngine(pkgDefault)
	return e
}

// IsValid returns true if the engine value is one of the known canonical values.
func (e WebEngine) IsValid() bool {
	switch e {
	case EngineNginx, EngineApache, EngineHybrid, EngineVarnishHybrid, EngineVarnishNginx:
		return true
	}
	return false
}

// NeedsApache returns true if this engine stack requires Apache to be running.
func (e WebEngine) NeedsApache() bool {
	return e == EngineApache || e == EngineHybrid || e == EngineVarnishHybrid
}

// NeedsVarnish returns true if this engine stack requires Varnish to be running.
func (e WebEngine) NeedsVarnish() bool {
	return e == EngineVarnishHybrid || e == EngineVarnishNginx
}

// IsHybrid returns true if Nginx should proxy to Apache on port 8081.
func (e WebEngine) IsHybrid() bool {
	return e == EngineApache || e == EngineHybrid || e == EngineVarnishHybrid
}

// String returns the canonical string representation.
func (e WebEngine) String() string {
	return string(e)
}

// ── SSL path helpers ──────────────────────────────────────────────────────────
// Canonical SSL paths per §3.8 of AGENT_MASTER_PLAN.md.
// All services MUST use these — never hardcode /etc/letsencrypt/live/.

const (
	// SSLBaseDir is the canonical base directory for all AKpanel-managed SSL certs.
	SSLBaseDir = "/etc/akpanel/ssl"
)

// SSLCertPath returns the canonical fullchain.pem path for a domain.
func SSLCertPath(domain string) string {
	return fmt.Sprintf("%s/%s/fullchain.pem", SSLBaseDir, domain)
}

// SSLKeyPath returns the canonical privkey.pem path for a domain.
func SSLKeyPath(domain string) string {
	return fmt.Sprintf("%s/%s/privkey.pem", SSLBaseDir, domain)
}

// SSLCertsExist returns true if both cert and key files exist for a domain.
func SSLCertsExist(domain string) bool {
	if _, err := os.Stat(SSLCertPath(domain)); err != nil {
		return false
	}
	if _, err := os.Stat(SSLKeyPath(domain)); err != nil {
		return false
	}
	return true
}
