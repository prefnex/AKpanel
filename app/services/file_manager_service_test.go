package services

import (
	"testing"
)

func TestValidateAdminPathSecurity(t *testing.T) {
	svc := NewFileManagerService()

	// 1. Path traversal attacks
	attacks := []string{
		"../../../../etc/shadow",
		"/etc/shadow",
		"/etc/gshadow",
		"/root/.ssh",
		"/root/.ssh/id_rsa",
		"/proc/1/cmdline",
		"/sys/kernel",
		"/dev/mem",
		"/var/www/sites/../../../etc/shadow",
		"/home/user/../../etc/shadow",
	}

	for _, attack := range attacks {
		_, err := svc.ValidateAdminPath(attack)
		if err == nil {
			t.Errorf("SECURITY RISK: expected error for traversal attack %q, got nil", attack)
		}
	}

	// 2. Legitimate paths
	validPaths := []string{
		"/var/www/sites",
		"/var/www/sites/example.com/public",
		"/home/john",
		"/home/john/domains/test.com/public_html",
		"/var/log/akpanel",
		"/tmp/uploads",
	}

	for _, valid := range validPaths {
		_, err := svc.ValidateAdminPath(valid)
		if err != nil {
			t.Errorf("expected valid path %q to pass, got error: %v", valid, err)
		}
	}
}
