package paths

import (
	"testing"
)

func TestPaths(t *testing.T) {
	if UserHome("john") != "/home/john" {
		t.Errorf("expected /home/john, got %s", UserHome("john"))
	}

	if UserDomainRoot("john", "example.com") != "/home/john/domains/example.com/public_html" {
		t.Errorf("expected /home/john/domains/example.com/public_html, got %s", UserDomainRoot("john", "example.com"))
	}

	if RootSiteRoot("mysite.com") != "/var/www/sites/mysite.com/public" {
		t.Errorf("expected /var/www/sites/mysite.com/public, got %s", RootSiteRoot("mysite.com"))
	}

	if NginxAvailable("example.com") != "/etc/nginx/sites-available/example.com.conf" {
		t.Errorf("expected /etc/nginx/sites-available/example.com.conf, got %s", NginxAvailable("example.com"))
	}

	if SSLCert("example.com") != "/etc/akpanel/ssl/example.com/fullchain.pem" {
		t.Errorf("expected /etc/akpanel/ssl/example.com/fullchain.pem, got %s", SSLCert("example.com"))
	}
}
