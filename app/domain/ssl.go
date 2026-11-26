package domain

import (
	"fmt"
	"os"
)

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
