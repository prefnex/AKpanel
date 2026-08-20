package domain

import "fmt"

// Server profile IDs — must match /etc/akpanel/server_profile.conf values.
const (
	ProfileNginxPHPFPM         = "nginx_phpfpm"
	ProfileApachePHPFPM        = "apache_phpfpm"
	ProfileHybridNginxApache   = "hybrid_nginx_apache"
	ProfileVarnishNginxApache  = "varnish_nginx_apache"
	ProfileVarnishNginxPHPFPM  = "varnish_nginx_phpfpm"
)

// ValidProfileIDs lists all supported global server profiles.
var ValidProfileIDs = []string{
	ProfileNginxPHPFPM,
	ProfileApachePHPFPM,
	ProfileHybridNginxApache,
	ProfileVarnishNginxApache,
	ProfileVarnishNginxPHPFPM,
}

// IsValidProfile returns true when profileID is a known server profile.
func IsValidProfile(profileID string) bool {
	for _, id := range ValidProfileIDs {
		if id == profileID {
			return true
		}
	}
	return false
}

// ProfileToSiteEngine maps a global server profile to the per-site engine string
// used by NginxService / provisioning when (re)building vhosts.
func ProfileToSiteEngine(profileID string) string {
	switch profileID {
	case ProfileNginxPHPFPM:
		return "nginx"
	case ProfileApachePHPFPM:
		return "apache"
	case ProfileHybridNginxApache:
		return "hybrid"
	case ProfileVarnishNginxApache:
		return "varnish+nginx+apache"
	case ProfileVarnishNginxPHPFPM:
		return "varnish+nginx+phpfpm"
	default:
		return "nginx"
	}
}

// ProfileNeedsApache reports whether Apache must be running for this profile.
func ProfileNeedsApache(profileID string) bool {
	switch profileID {
	case ProfileApachePHPFPM, ProfileHybridNginxApache, ProfileVarnishNginxApache:
		return true
	}
	return false
}

// ProfileNeedsVarnish reports whether Varnish must be running for this profile.
func ProfileNeedsVarnish(profileID string) bool {
	return profileID == ProfileVarnishNginxApache || profileID == ProfileVarnishNginxPHPFPM
}

// ValidateProfile returns an error for unknown profile IDs.
func ValidateProfile(profileID string) error {
	if !IsValidProfile(profileID) {
		return fmt.Errorf("unknown server profile %q — valid: nginx_phpfpm, apache_phpfpm, hybrid_nginx_apache, varnish_nginx_apache, varnish_nginx_phpfpm", profileID)
	}
	return nil
}
