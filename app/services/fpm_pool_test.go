package services

import (
	"strings"
	"testing"
)

func TestRenderUserFPMPool(t *testing.T) {
	for _, pm := range []string{"ondemand", "dynamic", "static", ""} {
		out, err := RenderUserFPMPool("alice", "8.2", "/home/alice/", 8, 512, FPMPoolDefaults{PM: pm, MaxRequests: 500, RequestTimeout: 300})
		if err != nil {
			t.Fatal(err)
		}
		for _, want := range []string{"[alice]", "user = alice", "pm.max_children = 8", "memory_limit] = 512M", "open_basedir] = /home/alice/:/tmp/", "pm.max_requests = 500", "request_terminate_timeout = 300s"} {
			if !strings.Contains(out, want) {
				t.Fatalf("pm=%q: missing %q in\n%s", pm, want, out)
			}
		}
		switch pm {
		case "dynamic":
			if !strings.Contains(out, "pm.start_servers = 2") || !strings.Contains(out, "pm.max_spare_servers = 4") {
				t.Fatalf("dynamic spares:\n%s", out)
			}
		case "", "ondemand":
			if !strings.Contains(out, "pm = ondemand") || !strings.Contains(out, "process_idle_timeout = 10s") {
				t.Fatalf("ondemand:\n%s", out)
			}
		}
	}
	out, _ := RenderUserFPMPool("bob", "8.3", "/home/bob", 1, 256, FPMPoolDefaults{PM: "dynamic"})
	if !strings.Contains(out, "pm.min_spare_servers = 1") || strings.Contains(out, "max_requests") {
		t.Fatalf("small dynamic:\n%s", out)
	}
	if (FPMPoolDefaults{PM: "turbo"}).Validate() == nil {
		t.Fatal("bad pm must fail")
	}
}
