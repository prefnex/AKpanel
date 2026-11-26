package services

import (
	"strings"
	"testing"
)

func TestSystemRedirects(t *testing.T) {
	d := DefaultSystemRedirects()
	if err := d.Validate(); err != nil {
		t.Fatal(err)
	}
	ng := renderNginxRedirects(d)
	if !strings.Contains(ng, "location = /cpanel { return 301 https://$host:2083/; }") || !strings.Contains(ng, "location = /cpanel/ {") {
		t.Fatalf("nginx:\n%s", ng)
	}
	ap := renderApacheRedirects(d)
	if !strings.Contains(ap, "RewriteRule ^/cpanel/?$ https://%{HTTP_HOST}:2083/ [R=301,L]") {
		t.Fatalf("apache:\n%s", ap)
	}
	if strings.Contains(renderNginxRedirects(SystemRedirects{Enabled: false, Rules: d.Rules}), "location") {
		t.Fatal("disabled must render nothing")
	}
	bad := []SystemRedirect{
		{"cpanel", "https://x/", 301}, {"/a b", "https://x/", 301}, {"/.well-known", "https://x/", 301},
		{"/x", "https://x/ ;rm", 301}, {"/x", "https://{evil}/", 301}, {"/x", "https://x/", 307}, {"/x", "", 301},
		{"/x;", "https://x/", 301}, {"/x", "https://x/\"; return 200 \"", 301},
	}
	for i, b := range bad {
		if (SystemRedirects{Rules: []SystemRedirect{b}}).Validate() == nil {
			t.Errorf("case %d should fail: %+v", i, b)
		}
	}
	if (SystemRedirects{Rules: []SystemRedirect{{"/a", "/b", 302}, {"/a", "/c", 301}}}).Validate() == nil {
		t.Error("duplicate path must fail")
	}
}

func TestCertCovers(t *testing.T) {
	names := []string{"example.com", "www.example.com", "webmail.example.com", "*.shop.example.com"}
	if !certCovers(names, "webmail.example.com") || certCovers(names, "mail.example.com") {
		t.Fatal("exact names")
	}
	if !certCovers(names, "a.shop.example.com") || certCovers(names, "a.b.shop.example.com") {
		t.Fatal("wildcard is one level deep")
	}
}
