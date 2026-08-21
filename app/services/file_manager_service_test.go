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

func TestValidateJailPath(t *testing.T) {
	svc := NewFileManagerService().WithJail("/home/alice")

	attacks := []string{
		"../../../../etc/shadow",
		"/etc/passwd",
		"/home",
		"/home/other",
		"/home/alice/../bob",
		"/tmp",
	}
	for _, attack := range attacks {
		_, err := svc.ValidateJailPath(attack)
		if err == nil {
			t.Errorf("expected jail deny for %q", attack)
		}
	}

	ok, err := svc.ValidateJailPath("/home/alice/domains")
	if err != nil {
		t.Fatalf("expected home child to pass: %v", err)
	}
	if ok != "/home/alice/domains" {
		t.Fatalf("got %q", ok)
	}
	home, err := svc.ValidateJailPath("/")
	if err != nil {
		t.Fatalf("empty/root should map to jail: %v", err)
	}
	if home != "/home/alice" {
		t.Fatalf("got %q", home)
	}
}
