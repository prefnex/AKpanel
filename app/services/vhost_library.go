package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"

	"goravel/app/domain"
	"goravel/app/models"
	"goravel/app/templates"
)

// Vhost library on the site side: which named templates (templates.Library) a domain uses,
// and how they change its view. Stored in websites.vhost_templates as a comma list;
// "" = the server default (WebServerDefaults), "none" = no templates.

const (
	defaultSiteTimeout   = 300
	defaultSiteMaxBodyMB = 128
)

// SiteVhostTemplatesState is what the API returns for one domain.
type SiteVhostTemplatesState struct {
	Domain    string   `json:"domain"`
	Selected  []string `json:"selected"`
	IsDefault bool     `json:"is_default"`
	Missing   []string `json:"missing,omitempty"` // selected but no longer in the library
}

// siteVhostTemplateNames reads a site's stored choice (or the server default).
func siteVhostTemplateNames(row *models.Website, owner string) ([]string, bool) {
	stored := ""
	if row != nil {
		stored = row.VhostTemplates
	}
	return templates.ParseTemplateList(stored, LoadWebServerDefaults().VhostTemplatesFor(owner)), strings.TrimSpace(stored) == ""
}

var (
	nginxDirectiveOnce sync.Once
	nginxHTTP2On       bool
	nginxVersionRe     = regexp.MustCompile(`nginx/(\d+)\.(\d+)\.(\d+)`)
)

// nginxHasHTTP2Directive: nginx 1.25.1+ wants `http2 on;`, older ones `listen … http2`.
func nginxHasHTTP2Directive() bool {
	nginxDirectiveOnce.Do(func() {
		out, err := exec.Command("nginx", "-v").CombinedOutput()
		if err != nil {
			return
		}
		m := nginxVersionRe.FindStringSubmatch(string(out))
		if m == nil {
			return
		}
		a, _ := strconv.Atoi(m[1])
		b, _ := strconv.Atoi(m[2])
		c, _ := strconv.Atoi(m[3])
		nginxHTTP2On = a > 1 || (a == 1 && (b > 25 || (b == 25 && c >= 1)))
	})
	return nginxHTTP2On
}

func indentLines(s, prefix string) string {
	lines := strings.Split(s, "\n")
	for i, l := range lines {
		if strings.TrimSpace(l) != "" {
			lines[i] = prefix + l
		} else {
			lines[i] = ""
		}
	}
	return strings.Join(lines, "\n")
}

// applyVhostLibrary folds the named templates into the site's view. Templates that are gone
// or do not render are skipped and reported in the returned notes; rendering never fails
// because of the library (a broken result is still caught by nginx -t / configtest).
func applyVhostLibrary(v *siteView, names []string) []string {
	v.Timeout, v.MaxBodyMB = defaultSiteTimeout, defaultSiteMaxBodyMB
	v.HTTP2Directive = nginxHasHTTP2Directive()
	var notes []string
	var list []templates.VhostTemplate
	app := ""
	for _, n := range names {
		t, err := templates.LibraryTemplate(n)
		if err != nil {
			notes = append(notes, "vhost template "+n+" is not in the library any more")
			continue
		}
		if t.Kind == templates.KindApp {
			if app != "" {
				notes = append(notes, "vhost template "+n+" ignored: "+app+" is already the application template")
				continue
			}
			app = t.Name
		}
		list = append(list, t)
	}

	timeout, maxBody := 0, 0
	for _, t := range list {
		v.VhostTemplates = append(v.VhostTemplates, t.Name)
		if t.HTTP2 {
			v.HTTP2 = true
		}
		if t.Wildcard && !strings.HasPrefix(v.Domain, "www.") {
			if !strings.Contains(v.ServerNames, "*."+v.Domain) {
				v.ServerNames += " *." + v.Domain
				v.ServerAliases += " *." + v.Domain
			}
		}
		if t.Timeout > timeout {
			timeout = t.Timeout
		}
		if t.MaxBodyMB > maxBody {
			maxBody = t.MaxBodyMB
		}
		if t.Kind == templates.KindApp && t.RootSuffix != "" && v.SiteType != domain.SiteTypeProxy &&
			!strings.HasSuffix(strings.TrimRight(v.Root, "/"), t.RootSuffix) {
			v.Root = strings.TrimRight(v.Root, "/") + t.RootSuffix
		}
	}
	if timeout > 0 {
		v.Timeout = timeout
	}
	if maxBody > 0 {
		v.MaxBodyMB = maxBody
	}
	v.LimitRequestBody = int64(v.MaxBodyMB) * 1024 * 1024
	if v.LimitRequestBody > 2147483647 {
		v.LimitRequestBody = 2147483647
	}

	var nginxParts, apacheParts []string
	for _, t := range list {
		header := "# vhost template: " + t.Name
		if s, err := templates.RenderSnippet(t.Name+"/nginx", t.Nginx, v); err != nil {
			notes = append(notes, t.Name+" (nginx): "+err.Error())
		} else if s != "" {
			nginxParts = append(nginxParts, header+"\n"+s)
		}
		if s, err := templates.RenderSnippet(t.Name+"/apache", t.Apache, v); err != nil {
			notes = append(notes, t.Name+" (apache): "+err.Error())
		} else if s != "" {
			apacheParts = append(apacheParts, header+"\n"+s)
		}
		if t.Kind == templates.KindApp && t.NginxLocation != "" {
			if s, err := templates.RenderSnippet(t.Name+"/nginx_location", t.NginxLocation, v); err != nil {
				notes = append(notes, t.Name+" (location): "+err.Error())
			} else {
				v.NginxLocation = indentLines("# vhost template: "+t.Name+"\n"+s, "    ")
			}
		}
	}
	if len(nginxParts) > 0 {
		v.NginxSnippets = indentLines(strings.Join(nginxParts, "\n\n"), "    ")
	}
	if len(apacheParts) > 0 {
		v.ApacheSnippets = indentLines(strings.Join(apacheParts, "\n\n"), "    ")
	}
	return notes
}

// sampleSiteView is what a custom template is test-rendered against before it is saved.
func sampleSiteView() siteView {
	return siteView{
		Mode: domain.ModeNginxApache, Domain: "example.com", ServerNames: "example.com www.example.com",
		ServerAliases: "www.example.com", Root: "/home/user/domains/example.com/public_html", Owner: "user",
		SiteType: domain.SiteTypePHP, Backend: domain.BackendApache, Handler: domain.HandlerFPM, PHPVersion: "8.2",
		PHPSocket: "unix:/run/php/php8.2-fpm-user.sock", SSLCert: "/etc/akpanel/ssl/example.com/fullchain.pem",
		SSLKey: "/etc/akpanel/ssl/example.com/privkey.pem", AcmeRoot: acmeWebRoot, ProxyPort: 3000, ProxyAddr: "127.0.0.1:3000",
		Timeout: defaultSiteTimeout, MaxBodyMB: defaultSiteMaxBodyMB,
	}
}

// ── API ───────────────────────────────────────────────────────────────────────

// LibraryEntry is a library template plus the domains using it.
type LibraryEntry struct {
	templates.VhostTemplate
	UsedBy    []string `json:"used_by"`
	IsDefault bool     `json:"is_default"`
}

// sitesUsing maps template name → domains that use it (stored choice or the default).
func sitesUsing() map[string][]string {
	use := map[string][]string{}
	if panelOrm() == nil {
		return use
	}
	var rows []models.Website
	if err := panelOrm().Query().Find(&rows); err != nil {
		return use
	}
	for i := range rows {
		names, _ := siteVhostTemplateNames(&rows[i], siteOwner(websiteConfigFromRow(&rows[i])))
		for _, n := range names {
			use[n] = append(use[n], rows[i].Domain)
		}
	}
	for k := range use {
		sort.Strings(use[k])
	}
	return use
}

// VhostLibrary lists the library with usage.
func (w *WebStackService) VhostLibrary() []LibraryEntry {
	use := sitesUsing()
	defs := LoadWebServerDefaults()
	isDef := map[string]bool{}
	for _, n := range append(append([]string{}, defs.VhostTemplates...), defs.AccountVhostTemplates...) {
		isDef[n] = true
	}
	var out []LibraryEntry
	for _, t := range templates.Library() {
		used := use[t.Name]
		if used == nil {
			used = []string{}
		}
		out = append(out, LibraryEntry{VhostTemplate: t, UsedBy: used, IsDefault: isDef[t.Name]})
	}
	return out
}

// applyDomainsTxn re-renders the given sites in one transaction (all or nothing).
func (w *WebStackService) applyDomainsTxn(domains []string) error {
	if len(domains) == 0 {
		return nil
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	mode := CurrentMode()
	t := newFSTxn()
	for _, d := range domains {
		row := lookupWebsiteRow(d)
		if row == nil {
			continue
		}
		if _, err := w.renderSite(t, mode, websiteConfigFromRow(row)); err != nil {
			t.Rollback()
			return fmt.Errorf("%s: %w", d, err)
		}
	}
	if err := w.verifyAndReload(mode, t); err != nil {
		t.Rollback()
		return err
	}
	return nil
}

// SaveVhostTemplate creates or edits a custom library template and rebuilds the sites that
// use it; if any of them fails the tests, the previous template version comes back.
func (w *WebStackService) SaveVhostTemplate(t templates.VhostTemplate) (LibraryEntry, error) {
	if err := t.Validate(); err != nil {
		return LibraryEntry{}, err
	}
	sample := sampleSiteView()
	for field, src := range map[string]string{"nginx": t.Nginx, "nginx_location": t.NginxLocation, "apache": t.Apache} {
		if _, err := templates.RenderSnippet(t.Name+"/"+field, src, sample); err != nil {
			return LibraryEntry{}, fmt.Errorf("%s snippet: %w", field, err)
		}
	}
	prev, err := templates.SaveLibraryTemplate(t)
	if err != nil {
		return LibraryEntry{}, err
	}
	used := sitesUsing()[t.Name]
	if err := w.applyDomainsTxn(used); err != nil {
		templates.RestoreLibraryTemplate(t.Name, prev)
		return LibraryEntry{}, fmt.Errorf("not saved, the sites using it would break: %w", err)
	}
	saved, _ := templates.LibraryTemplate(t.Name)
	if used == nil {
		used = []string{}
	}
	return LibraryEntry{VhostTemplate: saved, UsedBy: used}, nil
}

// DeleteVhostTemplate removes a custom template nobody uses.
func (w *WebStackService) DeleteVhostTemplate(name string) error {
	if used := sitesUsing()[name]; len(used) > 0 {
		return fmt.Errorf("%s is used by %s: remove it from those domains first", name, strings.Join(used, ", "))
	}
	defs := LoadWebServerDefaults()
	for _, n := range append(append([]string{}, defs.VhostTemplates...), defs.AccountVhostTemplates...) {
		if n == name {
			return fmt.Errorf("%s is a default for new domains (Main Conf): remove it there first", name)
		}
	}
	return templates.DeleteLibraryTemplate(name)
}

// SiteVhostTemplates reports one domain's templates.
func (w *WebStackService) SiteVhostTemplates(domainName string) (SiteVhostTemplatesState, error) {
	row := lookupWebsiteRow(domainName)
	if row == nil {
		return SiteVhostTemplatesState{}, fmt.Errorf("website %s not found", domainName)
	}
	names, isDefault := siteVhostTemplateNames(row, siteOwner(websiteConfigFromRow(row)))
	st := SiteVhostTemplatesState{Domain: domainName, Selected: names, IsDefault: isDefault}
	if st.Selected == nil {
		st.Selected = []string{}
	}
	for _, n := range names {
		if _, err := templates.LibraryTemplate(n); err != nil {
			st.Missing = append(st.Missing, n)
		}
	}
	return st, nil
}

// SetSiteVhostTemplates stores a domain's templates and applies them (restored on failure).
func (w *WebStackService) SetSiteVhostTemplates(domainName string, names []string, useDefault bool) (SiteVhostTemplatesState, error) {
	row := lookupWebsiteRow(domainName)
	if row == nil {
		return SiteVhostTemplatesState{}, fmt.Errorf("website %s not found", domainName)
	}
	stored := ""
	if !useDefault {
		if _, err := templates.ResolveTemplateList(names); err != nil {
			return SiteVhostTemplatesState{}, err
		}
		stored = templates.FormatTemplateList(names)
	}
	prev := row.VhostTemplates
	if _, err := panelOrm().Query().Model(&models.Website{}).Where("domain = ?", domainName).Update("vhost_templates", stored); err != nil {
		return SiteVhostTemplatesState{}, err
	}
	if _, err := w.ApplySite(websiteConfigFromRow(lookupWebsiteRow(domainName))); err != nil {
		_, _ = panelOrm().Query().Model(&models.Website{}).Where("domain = ?", domainName).Update("vhost_templates", prev)
		return SiteVhostTemplatesState{}, err
	}
	return w.SiteVhostTemplates(domainName)
}

// VhostPreview is what a domain's vhosts would look like with the given templates.
type VhostPreview struct {
	Nginx  string   `json:"nginx"`
	Apache string   `json:"apache"`
	Notes  []string `json:"notes"`
}

// PreviewSiteVhost renders a domain's vhosts with a template list without writing them.
func (w *WebStackService) PreviewSiteVhost(domainName string, names []string) (VhostPreview, error) {
	row := lookupWebsiteRow(domainName)
	if row == nil {
		return VhostPreview{}, fmt.Errorf("website %s not found", domainName)
	}
	if _, err := templates.ResolveTemplateList(names); err != nil {
		return VhostPreview{}, err
	}
	mode := CurrentMode()
	cfg := websiteConfigFromRow(row)
	v, res := w.buildSiteViewWith(mode, cfg, names, false)
	out := VhostPreview{Notes: res.Effective.Notes}
	if out.Notes == nil {
		out.Notes = []string{}
	}
	if mode.HasNginx() {
		s, err := templates.Render("nginx", "site.conf.tmpl", v)
		if err != nil {
			return out, err
		}
		out.Nginx = s
	}
	if mode.HasApache() && (mode == domain.ModeApache || res.Effective.Backend == domain.BackendApache) {
		s, err := templates.Render("apache", "site.conf.tmpl", v)
		if err != nil {
			return out, err
		}
		out.Apache = s
	}
	return out, nil
}

// ── Server-wide defaults (Main Conf) ──────────────────────────────────────────

const webServerDefaultsPath = "/etc/akpanel/webserver_defaults.json"

// WebServerDefaults are the Main Conf choices applied to domains that have no choice of
// their own. VhostTemplates applies to every domain; AccountVhostTemplates, when set,
// replaces it for domains owned by a hosting account.
type WebServerDefaults struct {
	VhostTemplates        []string        `json:"vhost_templates"`
	AccountVhostTemplates []string        `json:"account_vhost_templates"`
	FPM                   FPMPoolDefaults `json:"fpm"`
}

// LoadWebServerDefaults reads the defaults (empty when unset).
func LoadWebServerDefaults() WebServerDefaults {
	var d WebServerDefaults
	if b, err := os.ReadFile(webServerDefaultsPath); err == nil {
		_ = json.Unmarshal(b, &d)
	}
	d.VhostTemplates = templates.CleanTemplateList(d.VhostTemplates)
	d.AccountVhostTemplates = templates.CleanTemplateList(d.AccountVhostTemplates)
	d.FPM = d.FPM.Normalized()
	return d
}

// VhostTemplatesFor is the default list for a domain owned by owner.
func (d WebServerDefaults) VhostTemplatesFor(owner string) []string {
	if isAccountOwner(owner) && len(d.AccountVhostTemplates) > 0 {
		return d.AccountVhostTemplates
	}
	return d.VhostTemplates
}

func saveWebServerDefaults(d WebServerDefaults) error {
	if err := os.MkdirAll("/etc/akpanel", 0755); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(d, "", "  ")
	return os.WriteFile(webServerDefaultsPath, b, 0644)
}

// SiteVhostTemplateNamesFor is the list view's form of SiteVhostTemplates.
func SiteVhostTemplateNamesFor(row *models.Website) []string {
	names, _ := siteVhostTemplateNames(row, siteOwner(websiteConfigFromRow(row)))
	if names == nil {
		return []string{}
	}
	return names
}

// MainConfResult reports what saving Main Conf rebuilt.
type MainConfResult struct {
	Defaults       WebServerDefaults `json:"defaults"`
	SitesRebuilt   int               `json:"sites_rebuilt"`
	PoolsRewritten int               `json:"pools_rewritten"`
}

// SaveWebServerDefaults validates and stores Main Conf. With rebuild, every vhost is rebuilt
// (domains that follow the default pick up the new templates) and account pools are
// rewritten when the pool settings changed; a failed rebuild restores the previous settings.
func (w *WebStackService) SaveWebServerDefaults(d WebServerDefaults, rebuild bool) (MainConfResult, error) {
	if _, err := templates.ResolveTemplateList(d.VhostTemplates); err != nil {
		return MainConfResult{}, fmt.Errorf("default templates: %w", err)
	}
	if _, err := templates.ResolveTemplateList(d.AccountVhostTemplates); err != nil {
		return MainConfResult{}, fmt.Errorf("account default templates: %w", err)
	}
	if err := d.FPM.Validate(); err != nil {
		return MainConfResult{}, err
	}
	d.VhostTemplates = templates.CleanTemplateList(d.VhostTemplates)
	d.AccountVhostTemplates = templates.CleanTemplateList(d.AccountVhostTemplates)
	d.FPM = d.FPM.Normalized()

	prev := LoadWebServerDefaults()
	_, statErr := os.Stat(webServerDefaultsPath)
	restore := func() {
		if statErr != nil {
			_ = os.Remove(webServerDefaultsPath)
		} else {
			_ = saveWebServerDefaults(prev)
		}
	}
	if err := saveWebServerDefaults(d); err != nil {
		return MainConfResult{}, err
	}
	res := MainConfResult{Defaults: LoadWebServerDefaults()}
	if !rebuild {
		return res, nil
	}
	n, err := w.RebuildAll()
	if err != nil {
		restore()
		_, _ = w.RebuildAll()
		return MainConfResult{}, fmt.Errorf("not saved, the rebuild failed: %w", err)
	}
	res.SitesRebuilt = n
	if prev.FPM != d.FPM {
		p, err := RewriteAllPools()
		res.PoolsRewritten = p
		if err != nil {
			restore()
			_, _ = RewriteAllPools()
			_, _ = w.RebuildAll()
			return res, fmt.Errorf("pool settings not saved: %w", err)
		}
	}
	return res, nil
}
