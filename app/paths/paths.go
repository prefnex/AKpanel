// Package paths defines the canonical file paths used across AKpanel.
// This is the SINGLE source of truth for filesystem paths —
// do NOT hardcode paths in services, controllers, or scripts.
package paths

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	// Root sites base directory for admin/root created websites
	SitesRoot = "/var/www/sites"

	// Default web root
	DefaultWebRoot = "/var/www/html"

	// Roundcube webmail root (compat path; prefer RoundcubeWebRoot())
	RoundcubeRoot = "/var/www/roundcube"

	// User homes base directory
	UserHomes = "/home"

	// AKpanel system config and state root
	EtcAKpanel = "/etc/akpanel"

	// AKpanel secrets directory (restricted permissions)
	EtcAKpanelSecrets = "/etc/akpanel/secrets"

	// SSL base directory
	SSLBase = "/etc/akpanel/ssl"

	// Nginx configuration directories
	NginxAvailableDir = "/etc/nginx/sites-available"
	NginxEnabledDir   = "/etc/nginx/sites-enabled"

	// Apache configuration directories
	ApacheAvailableDir = "/etc/apache2/sites-available"
	ApacheEnabledDir   = "/etc/apache2/sites-enabled"

	// PHP-FPM runtime socket directory
	PHPSocketDir = "/run/php"

	// BIND 9 zones directory
	BINDZonesDir = "/etc/bind/zones"
)

// UserHome returns the home directory for a client user.
func UserHome(username string) string {
	return filepath.Join(UserHomes, username)
}

// UserDomainRoot returns the canonical document root for a domain owned by a client user.
// Format: /home/<username>/domains/<domain>/public_html
func UserDomainRoot(username, domain string) string {
	return filepath.Join(UserHome(username), "domains", domain, "public_html")
}

// UserLegacyDomainRoot returns the legacy single-domain document root: /home/<username>/public_html
func UserLegacyDomainRoot(username string) string {
	return filepath.Join(UserHome(username), "public_html")
}

// RootSiteRoot returns the canonical document root for a domain owned by the root admin.
// Format: /var/www/sites/<domain>/public
func RootSiteRoot(domain string) string {
	return filepath.Join(SitesRoot, domain, "public")
}

// ResolveWebsiteRoot determines the real document root based on owner and existing paths.
func ResolveWebsiteRoot(owner, domain string) string {
	domain = strings.TrimSpace(strings.ToLower(domain))
	owner = strings.TrimSpace(strings.ToLower(owner))

	if owner == "" || owner == "root" || owner == "admin" {
		return RootSiteRoot(domain)
	}

	// For client users, check if multi-domain path or legacy path exists
	primaryPath := UserDomainRoot(owner, domain)
	if _, err := os.Stat(primaryPath); err == nil {
		return primaryPath
	}

	legacyPath := UserLegacyDomainRoot(owner)
	if _, err := os.Stat(legacyPath); err == nil && (domain == owner+".local" || domain == "default.local") {
		return legacyPath
	}

	// Fallback to primary standard path
	return primaryPath
}

// NginxAvailable returns the full path for a domain's available Nginx vhost config.
func NginxAvailable(domain string) string {
	return filepath.Join(NginxAvailableDir, fmt.Sprintf("%s.conf", domain))
}

// NginxEnabled returns the full path for a domain's enabled Nginx vhost symlink.
func NginxEnabled(domain string) string {
	return filepath.Join(NginxEnabledDir, fmt.Sprintf("%s.conf", domain))
}

// ApacheAvailable returns the full path for a domain's available Apache vhost config.
func ApacheAvailable(domain string) string {
	return filepath.Join(ApacheAvailableDir, fmt.Sprintf("%s.conf", domain))
}

// ApacheEnabled returns the full path for a domain's enabled Apache vhost symlink.
func ApacheEnabled(domain string) string {
	return filepath.Join(ApacheEnabledDir, fmt.Sprintf("%s.conf", domain))
}

// DetectInstalledPHPVersion returns preferred if that FPM/CLI exists, else the newest installed PHP.
func DetectInstalledPHPVersion(preferred string) string {
	if versionHasPHP(preferred) {
		return preferred
	}
	for _, ver := range []string{"8.4", "8.3", "8.2", "8.1", "8.0", "7.4"} {
		if versionHasPHP(ver) {
			return ver
		}
	}
	if preferred != "" {
		return preferred
	}
	return "8.3"
}

func versionHasPHP(ver string) bool {
	if ver == "" {
		return false
	}
	if _, err := os.Stat(filepath.Join("/usr/bin", "php"+ver)); err == nil {
		return true
	}
	if _, err := os.Stat(filepath.Join(PHPSocketDir, fmt.Sprintf("php%s-fpm.sock", ver))); err == nil {
		return true
	}
	return false
}

// SSLCert returns the canonical fullchain.pem path for a domain.
func SSLCert(domain string) string {
	return filepath.Join(SSLBase, domain, "fullchain.pem")
}

// SSLKey returns the canonical privkey.pem path for a domain.
func SSLKey(domain string) string {
	return filepath.Join(SSLBase, domain, "privkey.pem")
}

// SSLDir returns the directory containing SSL certificates for a domain.
func SSLDir(domain string) string {
	return filepath.Join(SSLBase, domain)
}

// RoundcubeWebRoot is the document root nginx should use for Roundcube.
// Debian/Ubuntu packages live in /var/lib/roundcube and load /etc/roundcube.
func RoundcubeWebRoot() string {
	if _, err := os.Stat("/var/lib/roundcube/index.php"); err == nil {
		return "/var/lib/roundcube"
	}
	return RoundcubeRoot
}

// InstallConf returns the path to the main installation config file.
func InstallConf() string {
	return filepath.Join(EtcAKpanel, "install.conf")
}

// ServerProfileConf returns the path to the active server profile config.
func ServerProfileConf() string {
	return filepath.Join(EtcAKpanel, "server_profile.conf")
}

// UsersJSON returns the path to users.json (legacy user storage).
func UsersJSON() string {
	return filepath.Join(EtcAKpanel, "users.json")
}

// PackagesJSON returns the path to packages.json.
func PackagesJSON() string {
	return filepath.Join(EtcAKpanel, "packages.json")
}

// PHPSocket returns the unix socket path for a given PHP version (e.g. "8.2").
func PHPSocket(version string) string {
	if version == "" {
		version = "8.3"
	}
	return filepath.Join(PHPSocketDir, fmt.Sprintf("php%s-fpm.sock", version))
}

// PHPSocketForUser returns the per-user PHP-FPM socket path.
func PHPSocketForUser(version, username string) string {
	if version == "" {
		version = "8.3"
	}
	return filepath.Join(PHPSocketDir, fmt.Sprintf("php%s-fpm-%s.sock", version, username))
}
