package domain

import (
	"reflect"
	"testing"
)

func TestDefaultSiteServices(t *testing.T) {
	if got := DefaultSiteServices("alice", false); !reflect.DeepEqual(got, AllSiteServices) {
		t.Fatalf("account domain: %v", got)
	}
	if got := DefaultSiteServices("root", false); !reflect.DeepEqual(got, []SiteService{ServiceWebmail, ServiceMail}) {
		t.Fatalf("root site: %v", got)
	}
	if got := DefaultSiteServices("alice", true); got != nil {
		t.Fatalf("subdomain of a site: %v", got)
	}
}

func TestParseAndFormatSiteServices(t *testing.T) {
	def := []SiteService{ServiceWebmail}
	cases := []struct {
		stored string
		want   []SiteService
	}{
		{"", def},
		{"none", nil},
		{"ftp, WEBMAIL,bogus,ftp", []SiteService{ServiceWebmail, ServiceFTP}},
	}
	for _, c := range cases {
		if got := ParseSiteServices(c.stored, def); !reflect.DeepEqual(got, c.want) {
			t.Errorf("Parse(%q) = %v, want %v", c.stored, got, c.want)
		}
	}
	if got := FormatSiteServices(nil); got != SiteServicesNone {
		t.Errorf("Format(nil) = %q", got)
	}
	if got := FormatSiteServices([]SiteService{ServiceFTP, ServiceCpanel}); got != "cpanel,ftp" {
		t.Errorf("Format = %q", got)
	}
	if ServiceMail.Host("example.com") != "mail.example.com" {
		t.Error("Host")
	}
}
