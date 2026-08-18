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

// SaveCustomVCL writes custom VCL and reloads Varnish
func (v *VarnishService) SaveCustomVCL(vclContent string) error {
	_ = os.MkdirAll("/etc/varnish", 0755)
	if err := os.WriteFile(v.vclPath, []byte(vclContent), 0644); err != nil {
		return err
	}
	return v.Reload()
}
