package services

import (
	"strings"
	"testing"
)

func TestSetIniDirective(t *testing.T) {
	in := "[PHP]\n;memory_limit = 64M\nmemory_limit = 128M\n;date.timezone =\nopcache.enable_cli=0\n"
	out := setIniDirective(in, "memory_limit", "512M")
	if !strings.Contains(out, "\nmemory_limit = 512M\n") || !strings.Contains(out, ";memory_limit = 64M") {
		t.Fatalf("active line not replaced:\n%s", out)
	}
	out = setIniDirective(out, "date.timezone", "Africa/Cairo")
	if !strings.Contains(out, "\ndate.timezone = Africa/Cairo\n") {
		t.Fatalf("commented example not uncommented:\n%s", out)
	}
	out = setIniDirective(out, "opcache.enable", "1")
	if !strings.Contains(out, "opcache.enable_cli=0") || !strings.HasSuffix(out, "opcache.enable = 1\n") {
		t.Fatalf("missing key must be appended without touching enable_cli:\n%s", out)
	}
	if got := activeIniValue(out, "memory_limit"); got != "512M" {
		t.Fatalf("activeIniValue = %q", got)
	}
}

func TestNormaliseIniValue(t *testing.T) {
	cases := []struct {
		key, in, want string
		ok            bool
	}{
		{"memory_limit", "256m", "256M", true},
		{"memory_limit", "1G; rm -rf", "", false},
		{"display_errors", "1", "On", true},
		{"opcache.enable", "off", "0", true},
		{"max_execution_time", "abc", "", false},
		{"error_reporting", "E_ALL & ~E_DEPRECATED", "E_ALL & ~E_DEPRECATED", true},
		{"error_reporting", "E_ALL\nauto_prepend_file=/x", "", false},
	}
	for _, c := range cases {
		got, err := normaliseIniValue(iniDef(c.key), c.in)
		if (err == nil) != c.ok || got != c.want {
			t.Errorf("%s=%q → %q, %v", c.key, c.in, got, err)
		}
	}
	if iniBytes("128M") <= iniBytes("64M") || iniBytes("-1") != -1 {
		t.Fatal("iniBytes ordering")
	}
}

func TestValidatePool(t *testing.T) {
	ok := FpmPoolConfig{Pm: "dynamic", MaxChildren: 10, StartServers: 2, MinSpareServers: 1, MaxSpareServers: 3}
	if err := validatePool(&ok); err != nil {
		t.Fatal(err)
	}
	bad := ok
	bad.MaxSpareServers = 20
	if validatePool(&bad) == nil {
		t.Fatal("max_spare > max_children must fail")
	}
	od := FpmPoolConfig{Pm: "ondemand", MaxChildren: 5}
	if validatePool(&od) == nil {
		t.Fatal("ondemand needs idle timeout")
	}
	if requireVersion("../../etc") == nil {
		t.Fatal("path traversal version accepted")
	}
}
