package services

import (
	"strings"
	"testing"
)

func TestWelcomeIndexHasNoServerFingerprint(t *testing.T) {
	html := WelcomeIndexPHP("b2money.com", "b2money")
	for _, leak := range []string{"PHP_VERSION", "phpversion", "nginx", "php-fpm", "PHP 8"} {
		if strings.Contains(html, leak) {
			t.Errorf("welcome page leaked %q", leak)
		}
	}
	if !strings.Contains(html, "AKpanel") || !strings.Contains(html, "b2money.com") {
		t.Fatal("welcome page missing brand or domain")
	}
}

func TestSanitizeRedisACLUser(t *testing.T) {
	if got := sanitizeRedisACLUser("b2money"); got != "b2money" {
		t.Fatalf("got %q", got)
	}
	if sanitizeRedisACLUser("root") != "" || sanitizeRedisACLUser("akpanel-admin") != "" || sanitizeRedisACLUser("default") != "" {
		t.Fatal("privileged redis names must be rejected")
	}
}
