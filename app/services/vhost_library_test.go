package services

import (
	"strings"
	"testing"

	"goravel/app/domain"
	"goravel/app/templates"
)

func TestApplyVhostLibraryRenders(t *testing.T) {
	nginxDirectiveOnce.Do(func() {}) // do not run nginx -v in tests: old-style listen … http2
	all := []string{}
	for _, tpl := range templates.Library() {
		if tpl.Builtin && tpl.Kind == templates.KindFeature {
			all = append(all, tpl.Name)
		}
	}
	for _, app := range []string{"wordpress", "laravel", "magento2", "spa"} {
		for _, mode := range []domain.Mode{domain.ModeNginx, domain.ModeNginxApache, domain.ModeApache, domain.ModeNginxVarnish} {
			v := sampleSiteView()
			v.Mode = mode
			v.ApachePublic = mode == domain.ModeApache
			if mode == domain.ModeNginx || mode == domain.ModeNginxVarnish {
				v.Backend = domain.BackendNginx
			}
			if mode == domain.ModeNginxVarnish {
				v.Upstream, v.VarnishBackend, v.NginxOrigin, v.NginxOriginAddr = "varnish", "nginx", true, "127.0.0.1:8080"
			} else if mode == domain.ModeNginxApache {
				v.Upstream = "apache"
			}
			notes := applyVhostLibrary(&v, append([]string{app}, all...))
			if len(notes) > 0 {
				t.Fatalf("%s/%s notes: %v", app, mode, notes)
			}
			ng, err := templates.Render("nginx", "site.conf.tmpl", v)
			if err != nil {
				t.Fatalf("%s/%s nginx: %v", app, mode, err)
			}
			ap, err := templates.Render("apache", "site.conf.tmpl", v)
			if err != nil {
				t.Fatalf("%s/%s apache: %v", app, mode, err)
			}
			if !strings.Contains(ng, "listen 443 ssl http2;") || !strings.Contains(ng, "*.example.com") ||
				!strings.Contains(ng, "client_max_body_size 1024m;") || !strings.Contains(ng, "proxy_read_timeout 3600s;") {
				t.Fatalf("%s/%s: flags not applied:\n%s", app, mode, ng)
			}
			if !strings.Contains(ap, "Timeout 3600") || !strings.Contains(ap, "LimitRequestBody 1073741824") {
				t.Fatalf("%s/%s apache flags:\n%s", app, mode, ap)
			}
			if (mode == domain.ModeNginx || mode == domain.ModeNginxVarnish) && !strings.Contains(ng, "# vhost template: "+app) {
				t.Fatalf("%s/%s: app location missing:\n%s", app, mode, ng)
			}
		}
	}
	v := sampleSiteView()
	applyVhostLibrary(&v, []string{"laravel"})
	if !strings.HasSuffix(v.Root, "/public_html/public") {
		t.Fatalf("laravel root: %s", v.Root)
	}
	v = sampleSiteView()
	v.Root += "/public"
	applyVhostLibrary(&v, []string{"laravel"})
	if strings.HasSuffix(v.Root, "/public/public") {
		t.Fatalf("laravel root doubled: %s", v.Root)
	}
	v = sampleSiteView()
	if notes := applyVhostLibrary(&v, []string{"gone-template"}); len(notes) != 1 {
		t.Fatalf("missing template must be a note, got %v", notes)
	}
}
