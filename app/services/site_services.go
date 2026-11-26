package services

import (
	"encoding/json"
	"fmt"
	"html"
	"os"
	"path/filepath"
	"strings"

	"goravel/app/domain"
	"goravel/app/models"
	"goravel/app/paths"
)

// Per-domain service subdomains (webmail. mail. cpanel. ftp.), CWP-style. They are derived
// from the site: every time a site is rendered its service vhosts are brought in line with
// websites.services, so addon domains, root sites and mode switches all get them, and a
// removed site takes its service vhosts with it. They live in the service registry with
// Site set, which is how they are told apart from the panel's own service vhosts.

const serviceInfoRoot = "/var/www/sites/_service"

// SiteServicesState is what the API returns for one domain.
type SiteServicesState struct {
	Domain    string                   `json:"domain"`
	Enabled   []domain.SiteService     `json:"enabled"`
	IsDefault bool                     `json:"is_default"`
	Hosts     map[string]string        `json:"hosts"`   // service → host
	Skipped   map[string]string        `json:"skipped"` // service → why it is not served
	Available []domain.SiteServiceInfo `json:"available"`
}

// isSubdomainOfSite: blog.example.com when example.com is a site.
func isSubdomainOfSite(domainName string) bool {
	labels := strings.Split(domainName, ".")
	for i := 1; i < len(labels)-1; i++ {
		if lookupWebsiteRow(strings.Join(labels[i:], ".")) != nil {
			return true
		}
	}
	return false
}

// enabledSiteServices reads the stored choice (or the default) for a site.
func enabledSiteServices(cfg WebsiteConfig, row *models.Website) ([]domain.SiteService, bool) {
	defaults := domain.DefaultSiteServices(siteOwner(cfg), isSubdomainOfSite(cfg.Domain))
	stored := ""
	if row != nil {
		stored = row.Services
	}
	return domain.ParseSiteServices(stored, defaults), strings.TrimSpace(stored) == ""
}

func siteServiceVhost(svc domain.SiteService, site string) ServiceVhost {
	host := svc.Host(site)
	switch svc {
	case domain.ServiceCpanel:
		s := clientPanelService(host)
		s.Site = site
		return s
	case domain.ServiceFTP:
		return ServiceVhost{Name: host, Kind: "info", Host: host, Site: site, Root: filepath.Join(serviceInfoRoot, host)}
	default: // webmail, mail
		return ServiceVhost{Name: host, Kind: "webmail", Host: host, Site: site}
	}
}

func writeServiceInfoPage(s ServiceVhost) {
	if s.Kind != "info" || s.Root == "" {
		return
	}
	_ = os.MkdirAll(s.Root, 0755)
	index := filepath.Join(s.Root, "index.html")
	if _, err := os.Stat(index); err == nil {
		return
	}
	body := fmt.Sprintf(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>FTP</title></head>`+
		`<body style="font-family:sans-serif;max-width:40rem;margin:4rem auto"><h1>FTP</h1>`+
		`<p>Connect your FTP client to <b>%s</b> on port 21 (explicit TLS).</p></body></html>`, html.EscapeString(s.Host))
	_ = os.WriteFile(index, []byte(body), 0644)
}

// ownedBySite: registry entries a site manages, including legacy ones written before
// entries carried Site (webmail.X, cpanel.X, ftp.X, imap.X, pop.X created at signup).
func ownedBySite(s ServiceVhost, site string) bool {
	if s.Site != "" {
		return s.Site == site
	}
	for _, p := range domain.ServiceHostPrefixes {
		if s.Name == p+"."+site {
			return true
		}
	}
	return false
}

func (w *WebStackService) saveServicesTxn(t *fsTxn, list []ServiceVhost) error {
	sortServices(list)
	b, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return t.Write(serviceVhostsJSON, string(b), 0644)
}

// removeServiceFiles deletes a service vhost's files, never a customer site's.
func removeServiceFiles(t *fsTxn, name string) {
	if lookupWebsiteRow(name) != nil {
		return
	}
	for _, p := range []string{
		filepath.Join(paths.NginxEnabledDir, name+".conf"), filepath.Join(paths.NginxAvailableDir, name+".conf"),
		filepath.Join(paths.ApacheEnabledDir, name+".conf"), filepath.Join(paths.ApacheAvailableDir, name+".conf"),
	} {
		t.Remove(p)
	}
}

// syncSiteServices makes the site's service vhosts match its stored choice. Runs inside the
// caller's transaction, so a failed test or reload restores files and registry alike.
func (w *WebStackService) syncSiteServices(t *fsTxn, mode domain.Mode, cfg WebsiteConfig) error {
	row := lookupWebsiteRow(cfg.Domain)
	enabled, _ := enabledSiteServices(cfg, row)
	want := map[string]ServiceVhost{}
	for _, svc := range enabled {
		host := svc.Host(cfg.Domain)
		if lookupWebsiteRow(host) != nil {
			continue // a real site with that name wins
		}
		want[host] = siteServiceVhost(svc, cfg.Domain)
	}

	list := w.loadServices()
	out := make([]ServiceVhost, 0, len(list)+len(want))
	for _, s := range list {
		if s.Name == cfg.Domain && s.Site != "" {
			continue // this name is now a site of its own
		}
		if ownedBySite(s, cfg.Domain) {
			if _, keep := want[s.Name]; !keep {
				removeServiceFiles(t, s.Name)
				continue
			}
			continue // re-added below with current settings
		}
		out = append(out, s)
	}
	for _, s := range want {
		out = append(out, s)
	}
	if err := w.saveServicesTxn(t, out); err != nil {
		return err
	}
	for _, s := range want {
		writeServiceInfoPage(s)
		if err := w.renderOneService(t, mode, s.Name+".conf", s.Name+".conf", w.serviceViewFor(s)); err != nil {
			return fmt.Errorf("%s: %w", s.Name, err)
		}
	}
	return nil
}

// removeSiteServices drops every service vhost a site owns (site deletion).
func (w *WebStackService) removeSiteServices(t *fsTxn, site string) error {
	list := w.loadServices()
	out := list[:0]
	changed := false
	for _, s := range list {
		if ownedBySite(s, site) {
			removeServiceFiles(t, s.Name)
			changed = true
			continue
		}
		out = append(out, s)
	}
	if !changed {
		return nil
	}
	return w.saveServicesTxn(t, out)
}

// SiteServices reports a domain's service subdomains.
func (w *WebStackService) SiteServices(domainName string) (SiteServicesState, error) {
	row := lookupWebsiteRow(domainName)
	if row == nil {
		return SiteServicesState{}, fmt.Errorf("website %s not found", domainName)
	}
	cfg := websiteConfigFromRow(row)
	enabled, isDefault := enabledSiteServices(cfg, row)
	st := SiteServicesState{
		Domain: domainName, Enabled: enabled, IsDefault: isDefault,
		Hosts: map[string]string{}, Skipped: map[string]string{},
	}
	if st.Enabled == nil {
		st.Enabled = []domain.SiteService{}
	}
	for _, svc := range domain.AllSiteServices {
		st.Available = append(st.Available, svc.Info())
		host := svc.Host(domainName)
		st.Hosts[string(svc)] = host
		if lookupWebsiteRow(host) != nil {
			st.Skipped[string(svc)] = host + " is a website of its own"
		}
	}
	return st, nil
}

// SetSiteServices stores the domain's service subdomains and applies them.
func (w *WebStackService) SetSiteServices(domainName string, names []string, useDefault bool) (SiteServicesState, error) {
	row := lookupWebsiteRow(domainName)
	if row == nil {
		return SiteServicesState{}, fmt.Errorf("website %s not found", domainName)
	}
	for _, n := range names {
		if len(domain.NormalizeSiteServices([]string{n})) == 0 {
			return SiteServicesState{}, fmt.Errorf("unknown service %q", n)
		}
	}
	stored := ""
	if !useDefault {
		stored = domain.FormatSiteServices(domain.NormalizeSiteServices(names))
	}
	prev := row.Services
	if _, err := panelOrm().Query().Model(&models.Website{}).Where("domain = ?", domainName).Update("services", stored); err != nil {
		return SiteServicesState{}, err
	}
	if _, err := w.ApplySite(websiteConfigFromRow(lookupWebsiteRow(domainName))); err != nil {
		_, _ = panelOrm().Query().Model(&models.Website{}).Where("domain = ?", domainName).Update("services", prev)
		return SiteServicesState{}, err
	}
	return w.SiteServices(domainName)
}

// SiteServiceHosts lists the hostnames a certificate for domainName should also cover.
func SiteServiceHosts(domainName string) []string {
	row := lookupWebsiteRow(domainName)
	if row == nil {
		return nil
	}
	enabled, _ := enabledSiteServices(websiteConfigFromRow(row), row)
	var hosts []string
	for _, svc := range enabled {
		host := svc.Host(domainName)
		if lookupWebsiteRow(host) == nil {
			hosts = append(hosts, host)
		}
	}
	return hosts
}

// EnabledSiteServicesFor is the list view's cheap form of SiteServices.
func EnabledSiteServicesFor(row *models.Website) []domain.SiteService {
	enabled, _ := enabledSiteServices(websiteConfigFromRow(row), row)
	if enabled == nil {
		return []domain.SiteService{}
	}
	return enabled
}
