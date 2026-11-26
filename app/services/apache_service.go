package services

// Apache vhosts, ports.conf, modules and the global conf are rendered by WebStackService
// (templates apache/*.tmpl) for the current mode: loopback backend on 127.0.0.1:8081 behind
// nginx, or the public server on :80/:443 in mode "apache".

// ApacheService keeps the small API older callers use.
type ApacheService struct{}

func NewApacheService() *ApacheService { return &ApacheService{} }

// ReloadApache tests and reloads Apache when the current mode runs it.
func (a *ApacheService) ReloadApache() error {
	if !CurrentMode().HasApache() {
		return nil
	}
	if err := testApache(); err != nil {
		return err
	}
	return reloadUnit("apache2")
}
