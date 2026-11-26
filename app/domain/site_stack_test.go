package domain

import "testing"

func TestResolveStackKeepsRequestAcrossModes(t *testing.T) {
	req := SiteStack{SiteType: "php", Backend: BackendNginx}

	if got := ResolveStack(ModeApache, req, true); got.Backend != BackendApache || len(got.Notes) == 0 {
		t.Fatalf("apache mode must force apache with a note, got %+v", got)
	}
	if got := ResolveStack(ModeNginxApache, req, true); got.Backend != BackendNginx {
		t.Fatalf("nginx_apache must honour nginx request, got %+v", got)
	}
}

func TestResolveStackDefaults(t *testing.T) {
	cases := []struct {
		mode    Mode
		backend Backend
		varnish bool
	}{
		{ModeApache, BackendApache, false},
		{ModeNginx, BackendNginx, false},
		{ModeNginxApache, BackendApache, false},
		{ModeNginxVarnish, BackendNginx, true},
		{ModeNginxVarnishApache, BackendApache, false},
	}
	for _, c := range cases {
		got := ResolveStack(c.mode, SiteStack{}, true)
		if got.Backend != c.backend || got.Varnish != c.varnish {
			t.Errorf("%s: got backend=%s varnish=%v", c.mode, got.Backend, got.Varnish)
		}
	}
}

func TestResolveStackHandlerAndSiteTypes(t *testing.T) {
	cgi := SiteStack{SiteType: "php", Backend: BackendApache, PHPHandler: HandlerCGI}
	if got := ResolveStack(ModeNginxApache, cgi, false); got.PHPHandler != HandlerFPM {
		t.Fatalf("cgi without packages must fall back to fpm, got %s", got.PHPHandler)
	}
	if got := ResolveStack(ModeNginxApache, cgi, true); got.PHPHandler != HandlerCGI {
		t.Fatalf("cgi requested and available, got %s", got.PHPHandler)
	}
	proxy := SiteStack{SiteType: "proxy", Backend: BackendApache, Varnish: VarnishOn}
	if got := ResolveStack(ModeNginxVarnishApache, proxy, true); got.Backend != BackendNginx || got.Varnish {
		t.Fatalf("proxy sites are served by the front server without varnish, got %+v", got)
	}
	if got := ResolveStack(ModeApache, SiteStack{SiteType: "static"}, true); got.Backend != BackendApache {
		t.Fatalf("static site in apache mode served by apache, got %+v", got)
	}
}

func TestParseModeLegacy(t *testing.T) {
	for raw, want := range map[string]Mode{
		"apache_phpfpm":        ModeApache,
		"hybrid_nginx_apache":  ModeNginxApache,
		"varnish_nginx_phpfpm": ModeNginxVarnish,
		"nginx_varnish_apache": ModeNginxVarnishApache,
	} {
		if got := NormalizeMode(raw); got != want {
			t.Errorf("%s → %s, want %s", raw, got, want)
		}
	}
}

func TestProxyTarget(t *testing.T) {
	for _, ok := range []string{"", "127.0.0.1", "10.0.0.5", "::1", "[fd00::5]", "app.internal", "node-1.example.com"} {
		if err := ValidateProxyTarget(ok, 3000); err != nil {
			t.Errorf("%q: %v", ok, err)
		}
	}
	for _, bad := range []string{"a b", "x;rm", "host/path", "-bad.com", "http://x"} {
		if ValidateProxyTarget(bad, 3000) == nil {
			t.Errorf("%q should be rejected", bad)
		}
	}
	if ValidateProxyTarget("", 0) == nil || ValidateProxyTarget("", 70000) == nil {
		t.Error("bad ports must be rejected")
	}
	if ProxyAddr("", 3000) != "127.0.0.1:3000" || ProxyAddr("::1", 8080) != "[::1]:8080" || ProxyAddr("[fd00::5]", 80) != "[fd00::5]:80" {
		t.Error("ProxyAddr")
	}
	eff := ResolveStack(ModeNginxApache, SiteStack{SiteType: SiteTypeProxy, ProxyPort: 8181, ProxyHost: "10.1.1.1"}, true)
	if eff.ProxyHost != "10.1.1.1" {
		t.Errorf("effective host %q", eff.ProxyHost)
	}
}
