package templates

import "testing"

func TestBuiltinLibraryValidates(t *testing.T) {
	seen := map[string]bool{}
	for _, tpl := range Library() {
		if !tpl.Builtin {
			continue
		}
		if seen[tpl.Name] {
			t.Fatalf("duplicate built-in %s", tpl.Name)
		}
		seen[tpl.Name] = true
		if err := tpl.Validate(); err != nil {
			t.Errorf("%s: %v", tpl.Name, err)
		}
	}
	if len(seen) < 20 {
		t.Fatalf("expected the full library, got %d", len(seen))
	}
}

func TestTemplateLists(t *testing.T) {
	if got := ParseTemplateList("", []string{"http2"}); len(got) != 1 || got[0] != "http2" {
		t.Fatalf("default: %v", got)
	}
	if got := ParseTemplateList("none", []string{"http2"}); got != nil {
		t.Fatalf("none: %v", got)
	}
	if got := ParseTemplateList(" force-https, http2,force-https ", nil); len(got) != 2 {
		t.Fatalf("dedupe: %v", got)
	}
	if FormatTemplateList(nil) != "none" || FormatTemplateList([]string{"a", "a", "b"}) != "a,b" {
		t.Fatal("format")
	}
	if _, err := ResolveTemplateList([]string{"wordpress", "laravel"}); err == nil {
		t.Fatal("two apps must be refused")
	}
	if _, err := ResolveTemplateList([]string{"nope-nope"}); err == nil {
		t.Fatal("unknown template must be refused")
	}
	if _, err := ResolveTemplateList([]string{"wordpress", "force-https", "http2"}); err != nil {
		t.Fatal(err)
	}
}

func TestValidateRejects(t *testing.T) {
	bad := []VhostTemplate{
		{Name: "X", Title: "t", Kind: KindFeature},
		{Name: "ok-name", Title: "", Kind: KindFeature},
		{Name: "ok-name", Title: "t", Kind: "other"},
		{Name: "ok-name", Title: "t", Kind: KindFeature, RootSuffix: "/public"},
		{Name: "ok-name", Title: "t", Kind: KindApp, RootSuffix: "/../etc"},
		{Name: "ok-name", Title: "t", Kind: KindFeature, Nginx: "{{if}}"},
	}
	for i, b := range bad {
		if err := b.Validate(); err == nil {
			t.Errorf("case %d should fail", i)
		}
	}
	if _, err := SaveLibraryTemplate(VhostTemplate{Name: "wordpress", Title: "x", Kind: KindApp}); err == nil {
		t.Fatal("overwriting a built-in must be refused")
	}
}
