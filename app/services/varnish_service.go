package services

import (
	"fmt"
	"os"
	"os/exec"
)

type VarnishService struct {
	vclPath string
}

func NewVarnishService() *VarnishService {
	return &VarnishService{
		vclPath: "/etc/varnish/default.vcl",
	}
}

// PurgeCache purges all or specific URL cached items from Varnish RAM cache
func (v *VarnishService) PurgeCache(pattern string) error {
	if pattern == "" {
		pattern = ".*"
	}
	cmd := exec.Command("varnishadm", fmt.Sprintf("ban req.url ~ %s", pattern))
	return cmd.Run()
}

// IsRunning checks if Varnish daemon is active
func (v *VarnishService) IsRunning() bool {
	cmd := exec.Command("service", "varnish", "status")
	return cmd.Run() == nil
}

// Reload reloads the active Varnish VCL configuration
func (v *VarnishService) Reload() error {
	cmd := exec.Command("service", "varnish", "reload")
	return cmd.Run()
}

// EnsureDefaultVCL writes a profile-appropriate VCL and reloads Varnish.
func (v *VarnishService) EnsureDefaultVCL(profileID string) error {
	if profileID != "varnish_nginx_apache" && profileID != "varnish_nginx_phpfpm" {
		return nil
	}

	backendHost := "127.0.0.1"
	backendPort := "8081"
	if profileID == "varnish_nginx_phpfpm" {
		backendPort = "8080"
	}

	vcl := fmt.Sprintf(`vcl 4.1;

backend default {
    .host = "%s";
    .port = "%s";
}

sub vcl_recv {
    if (req.method == "PURGE") {
        return (purge);
    }
    if (req.url ~ "^/\\.well-known/acme-challenge/") {
        return (pass);
    }
    return (hash);
}

sub vcl_backend_response {
    set beresp.ttl = 2h;
    set beresp.grace = 1h;
}

sub vcl_deliver {
    if (obj.hits > 0) {
        set resp.http.X-Cache = "HIT";
    } else {
        set resp.http.X-Cache = "MISS";
    }
}
`, backendHost, backendPort)

	return v.SaveCustomVCL(vcl)
}

// SaveCustomVCL writes custom VCL and reloads Varnish
func (v *VarnishService) SaveCustomVCL(vclContent string) error {
	_ = os.MkdirAll("/etc/varnish", 0755)
	if err := os.WriteFile(v.vclPath, []byte(vclContent), 0644); err != nil {
		return err
	}
	return v.Reload()
}
