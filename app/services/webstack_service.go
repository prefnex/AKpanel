package services

import (
	"encoding/json"
	"fmt"
	contractsorm "github.com/goravel/framework/contracts/database/orm"
	"github.com/goravel/framework/facades"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"goravel/app/domain"
	"goravel/app/models"
	"goravel/app/paths"
	"goravel/app/templates"
)

// WebStackService is the ONLY writer of web server configuration (nginx, Apache, Varnish).
// Every vhost is rendered from app/templates for the current domain.Mode and the site's
// domain.SiteStack, tested, and reloaded in the order AGENTS.md requires; a failed test
// restores the previous files.
type WebStackService struct {
	mu sync.Mutex
}

var (
	webStackOnce     sync.Once
	webStackInstance *WebStackService
)

func GetWebStack() *WebStackService {
	webStackOnce.Do(func() { webStackInstance = &WebStackService{} })
	return webStackInstance
}

// panelOrm returns the ORM, or nil when the framework is not booted
// (`akpanel --bootstrap-services` runs before bootstrap.Boot()).
func panelOrm() (o contractsorm.Orm) {
	defer func() {
		if recover() != nil {
			o = nil
		}
	}()
	return facades.Orm()
}

// CurrentMode reads the active web server mode (legacy IDs accepted).
func CurrentMode() domain.Mode {
	b, err := os.ReadFile(paths.ServerProfileConf())
	if err != nil {
		return domain.ModeNginx
	}
	return domain.NormalizeMode(string(b))
}

const (
	nginxCustomDir    = "/etc/nginx/akpanel/custom"
	apacheCustomDir   = "/etc/apache2/akpanel/custom"
	nginxGlobalConf   = "/etc/nginx/conf.d/akpanel-global.conf"
	nginxProxySnippet = "/etc/nginx/snippets/akpanel-proxy.conf"
	apacheGlobalConf  = "/etc/apache2/conf-available/akpanel.conf"
	apachePortsConf   = "/etc/apache2/ports.conf"
	varnishVCL        = "/etc/varnish/default.vcl"
	varnishDropIn     = "/etc/systemd/system/varnish.service.d/akpanel.conf"
	serviceVhostsJSON = "/etc/akpanel/service_vhosts.json"
	acmeWebRoot       = "/var/www/html"
)

// ── Site rendering ────────────────────────────────────────────────────────────

type siteView struct {
	Mode            domain.Mode
	Domain          string
	ServerNames     string
	ServerAliases   string
	Root            string
	Owner           string
	SiteType        string
	Backend         domain.Backend
	Handler         domain.PHPHandler
	Varnish         bool
	PHPVersion      string
	PHPSocket       string
	CGIWrapper      string
	SuexecUser      string
	ProxyPort       int
	ProxyAddr       string // host:port of a proxy site's upstream
	SSLCert         string
	SSLKey          string
	IPv6            bool
	NginxHold       string
	ApacheHold      string
	NginxCustom     string
	ApacheCustom    string
	AcmeRoot        string
	Upstream        string
	VarnishBackend  string
	NginxOrigin     bool
	NginxOriginAddr string
	ApachePublic    bool
	ApachePort      int
	ApacheAddr      string
	VarnishAddr     string

	// Vhost library (applyVhostLibrary).
	VhostTemplates   []string
	NginxSnippets    string
	NginxLocation    string
	ApacheSnippets   string
	HTTP2            bool
	HTTP2Directive   bool
	Timeout          int
	MaxBodyMB        int
	LimitRequestBody int64
}

// SiteResult is what ApplySite reports back.
type SiteResult struct {
	Domain    string                `json:"domain"`
	Requested domain.SiteStack      `json:"requested"`
	Effective domain.EffectiveStack `json:"effective"`
}

func lookupWebsiteRow(domainName string) *models.Website {
	if panelOrm() == nil {
		return nil
	}
	var r models.Website
	if err := panelOrm().Query().Where("domain = ?", domainName).First(&r); err != nil || r.ID == 0 {
		return nil
	}
	return &r
}

// stackRequest merges the caller's config with the stored per-domain choice. An explicit
// per-domain choice (websites.backend set) always wins over package/legacy defaults.
func stackRequest(cfg WebsiteConfig, row *models.Website) domain.SiteStack {
	req := domain.SiteStack{SiteType: cfg.SiteType, ProxyPort: cfg.ProxyPort, ProxyHost: cfg.ProxyHost}
	if row != nil && row.Backend != "" {
		rr := row.StackRequest()
		req.Backend, req.PHPHandler, req.Varnish = rr.Backend, rr.PHPHandler, rr.Varnish
	} else {
		raw := cfg.Backend
		if raw == "" {
			raw = cfg.ServerEngine
		}
		req.Backend, req.Varnish = domain.ParseBackend(raw)
		req.PHPHandler = domain.ParsePHPHandler(cfg.PHPHandler)
		if cfg.Varnish != "" {
			req.Varnish = domain.ParseVarnish(cfg.Varnish)
		}
		if row != nil {
			if row.PHPHandler != "" && cfg.PHPHandler == "" {
				req.PHPHandler = domain.ParsePHPHandler(row.PHPHandler)
			}
			if row.Varnish != "" && cfg.Varnish == "" {
				req.Varnish = domain.ParseVarnish(row.Varnish)
			}
		}
	}
	if req.SiteType == "" && row != nil {
		req.SiteType = row.SiteType
	}
	if req.SiteType == "" {
		req.SiteType = domain.SiteTypePHP
	}
	if req.ProxyPort == 0 && row != nil {
		req.ProxyPort = row.ProxyPort
	}
	if req.ProxyHost == "" && row != nil {
		req.ProxyHost = row.ProxyHost
	}
	return req
}

func siteOwner(cfg WebsiteConfig) string {
	owner := strings.TrimSpace(cfg.OwnerUsername)
	if owner == "" {
		owner = linuxAccountFromPath(cfg.RootPath)
	}
	if owner == "admin" {
		owner = "root"
	}
	return owner
}

// sitePHPVersion: an account's sites run on the account version; root sites on their own
// version, else the server default for the backend that runs them.
func sitePHPVersion(cfg WebsiteConfig, owner string, backend domain.Backend) string {
	if isAccountOwner(owner) {
		if acc, err := NewUserAccountService().GetUser(owner); err == nil && acc != nil && acc.PHPVersion != "" {
			return paths.DetectInstalledPHPVersion(acc.PHPVersion)
		}
	}
	if v := strings.TrimSpace(cfg.PHPVersion); paths.PHPFPMInstalled(v) {
		return v
	}
	return paths.DefaultPHPVersionFor(string(backend))
}

func (w *WebStackService) buildSiteView(mode domain.Mode, cfg WebsiteConfig) (siteView, SiteResult) {
	return w.buildSiteViewWith(mode, cfg, nil, true)
}

// buildSiteViewWith builds the view with the site's stored vhost templates (useStored) or
// with names (previews).
func (w *WebStackService) buildSiteViewWith(mode domain.Mode, cfg WebsiteConfig, names []string, useStored bool) (siteView, SiteResult) {
	row := lookupWebsiteRow(cfg.Domain)
	req := stackRequest(cfg, row)
	owner := siteOwner(cfg)

	// Resolve once to know the backend, then again with the right version for cgi checks.
	eff := domain.ResolveStack(mode, req, true)
	version := sitePHPVersion(cfg, owner, eff.Backend)
	eff = domain.ResolveStack(mode, req, cgiHandlerAvailable(version))

	root := cfg.RootPath
	if root == "" && row != nil {
		root = row.RootPath
	}
	if root == "" {
		root = paths.ResolveWebsiteRoot(owner, cfg.Domain)
	}

	sockCfg := cfg
	sockCfg.PHPVersion = version
	sockCfg.OwnerUsername = owner
	sslCert, sslKey := siteSSLPaths(cfg.Domain)

	v := siteView{
		Mode:            mode,
		Domain:          cfg.Domain,
		ServerNames:     cfg.Domain + " www." + cfg.Domain,
		ServerAliases:   "www." + cfg.Domain,
		Root:            root,
		SiteType:        eff.SiteType,
		Backend:         eff.Backend,
		Handler:         eff.PHPHandler,
		Varnish:         eff.Varnish,
		PHPVersion:      version,
		PHPSocket:       resolveSitePHPSocket(sockCfg),
		ProxyPort:       eff.ProxyPort,
		ProxyAddr:       domain.ProxyAddr(eff.ProxyHost, eff.ProxyPort),
		SSLCert:         sslCert,
		SSLKey:          sslKey,
		IPv6:            ipv6ListenSupported(),
		NginxCustom:     filepath.Join(nginxCustomDir, cfg.Domain+".conf"),
		ApacheCustom:    filepath.Join(apacheCustomDir, cfg.Domain+".conf"),
		AcmeRoot:        acmeWebRoot,
		NginxOriginAddr: domain.NginxBackendAddr,
		ApachePublic:    mode == domain.ModeApache,
		ApachePort:      domain.ApacheBackendPort,
		ApacheAddr:      domain.ApacheBackendAddr,
		VarnishAddr:     domain.VarnishListenAddr,
	}
	if strings.HasPrefix(cfg.Domain, "www.") {
		v.ServerNames, v.ServerAliases = cfg.Domain, cfg.Domain
	}
	if isAccountOwner(owner) {
		v.Owner = owner
		held := false
		if _, err := os.Stat(accountFlagPath(owner)); err == nil {
			held = true
		}
		writeNginxHoldInclude(owner, held)
		v.NginxHold = nginxHoldIncludePath(owner)
		v.ApacheHold = strings.TrimRight(ApacheAccountHoldSnippet(owner), "\n")
	}
	if eff.PHPHandler == domain.HandlerCGI {
		if wrapper, err := EnsurePHPCGIWrapper(owner, version); err == nil {
			v.CGIWrapper = wrapper
			if isAccountOwner(owner) {
				v.SuexecUser = owner
			}
		} else {
			v.Handler = domain.HandlerFPM
			eff.PHPHandler = domain.HandlerFPM
			eff.Notes = append(eff.Notes, "php-cgi wrapper: "+err.Error())
		}
	}

	switch {
	case !mode.HasNginx() || eff.SiteType == domain.SiteTypeProxy:
	case eff.Varnish:
		v.Upstream = "varnish"
		v.VarnishBackend = string(eff.Backend)
		v.NginxOrigin = eff.Backend == domain.BackendNginx
	case eff.Backend == domain.BackendApache:
		v.Upstream = "apache"
	}

	if useStored {
		names, _ = siteVhostTemplateNames(row, owner)
	}
	eff.Notes = append(eff.Notes, applyVhostLibrary(&v, names)...)

	return v, SiteResult{Domain: cfg.Domain, Requested: req, Effective: eff}
}

func ensureCustomIncludes(domainName string) {
	for _, p := range []string{
		filepath.Join(nginxCustomDir, domainName+".conf"),
		filepath.Join(apacheCustomDir, domainName+".conf"),
	} {
		if _, err := os.Stat(p); err == nil {
			continue
		}
		_ = os.MkdirAll(filepath.Dir(p), 0755)
		_ = os.WriteFile(p, []byte("# Custom directives for "+domainName+" — kept across AKpanel rebuilds.\n"), 0644)
	}
}

// renderSite writes (into t) every file the site needs in this mode and removes the ones
// it does not need any more.
func (w *WebStackService) renderSite(t *fsTxn, mode domain.Mode, cfg WebsiteConfig) (SiteResult, error) {
	v, res := w.buildSiteView(mode, cfg)
	ensureCustomIncludes(cfg.Domain)

	nginxAvail, nginxEnabled := paths.NginxAvailable(cfg.Domain), paths.NginxEnabled(cfg.Domain)
	apacheAvail, apacheEnabled := paths.ApacheAvailable(cfg.Domain), paths.ApacheEnabled(cfg.Domain)

	if mode.HasNginx() {
		conf, err := templates.Render("nginx", "site.conf.tmpl", v)
		if err != nil {
			return res, err
		}
		if err := t.Write(nginxAvail, conf, 0644); err != nil {
			return res, err
		}
		if err := t.Symlink(nginxAvail, nginxEnabled); err != nil {
			return res, err
		}
	} else {
		t.Remove(nginxEnabled)
		t.Remove(nginxAvail)
	}

	needApache := mode.HasApache() && (mode == domain.ModeApache || res.Effective.Backend == domain.BackendApache)
	if needApache {
		conf, err := templates.Render("apache", "site.conf.tmpl", v)
		if err != nil {
			return res, err
		}
		if err := t.Write(apacheAvail, conf, 0644); err != nil {
			return res, err
		}
		if err := t.Symlink(apacheAvail, apacheEnabled); err != nil {
			return res, err
		}
	} else {
		t.Remove(apacheEnabled)
		t.Remove(apacheAvail)
	}
	if err := w.syncSiteServices(t, mode, cfg); err != nil {
		return res, err
	}
	return res, nil
}

// ApplySite renders, tests and reloads one site.
func (w *WebStackService) ApplySite(cfg WebsiteConfig) (SiteResult, error) {
	if cfg.Domain == "" {
		return SiteResult{}, fmt.Errorf("domain cannot be empty")
	}
	w.mu.Lock()
	defer w.mu.Unlock()

	mode := CurrentMode()
	t := newFSTxn()
	res, err := w.renderSite(t, mode, cfg)
	if err != nil {
		t.Rollback()
		return res, err
	}
	if err := w.verifyAndReload(mode, t); err != nil {
		t.Rollback()
		return res, err
	}
	w.persistEffective(cfg.Domain, res)
	return res, nil
}

// persistEffective keeps the websites row honest: php_version is what runs, and legacy
// rows get their request written to the new columns.
func (w *WebStackService) persistEffective(domainName string, res SiteResult) {
	row := lookupWebsiteRow(domainName)
	if row == nil {
		return
	}
	upd := map[string]any{}
	if row.Backend == "" && res.Requested.Backend != "" {
		upd["backend"] = string(res.Requested.Backend)
	}
	if len(upd) > 0 {
		_, _ = panelOrm().Query().Model(&models.Website{}).Where("domain = ?", domainName).Update(upd)
	}
}

// SetSiteStack stores a new per-domain request and applies it.
func (w *WebStackService) SetSiteStack(domainName string, req domain.SiteStack) (SiteResult, error) {
	row := lookupWebsiteRow(domainName)
	if row == nil {
		return SiteResult{}, fmt.Errorf("website %s not found", domainName)
	}
	if req.Backend != "" && req.Backend != domain.BackendApache && req.Backend != domain.BackendNginx {
		return SiteResult{}, fmt.Errorf("unknown backend %q", req.Backend)
	}
	backend := string(req.Backend)
	if backend == "" {
		backend = "default"
	}
	upd := map[string]any{
		"backend":     backend,
		"php_handler": string(domain.ParsePHPHandler(string(req.PHPHandler))),
		"varnish":     domain.ParseVarnish(req.Varnish),
	}
	if req.SiteType != "" {
		upd["site_type"] = req.SiteType
	}
	if req.SiteType == domain.SiteTypeProxy || (req.SiteType == "" && row.SiteType == domain.SiteTypeProxy) {
		port := req.ProxyPort
		if port == 0 {
			port = row.ProxyPort
		}
		if err := domain.ValidateProxyTarget(req.ProxyHost, port); err != nil {
			return SiteResult{}, err
		}
		upd["proxy_host"] = strings.TrimSpace(req.ProxyHost)
	}
	if req.ProxyPort > 0 {
		upd["proxy_port"] = req.ProxyPort
	}
	if _, err := panelOrm().Query().Model(&models.Website{}).Where("domain = ?", domainName).Update(upd); err != nil {
		return SiteResult{}, err
	}
	row = lookupWebsiteRow(domainName)
	return w.ApplySite(websiteConfigFromRow(row))
}

// SiteStatus reports requested vs effective without writing anything.
func (w *WebStackService) SiteStatus(row *models.Website) SiteResult {
	_, res := w.buildSiteViewNoSideEffects(CurrentMode(), websiteConfigFromRow(row))
	return res
}

func (w *WebStackService) buildSiteViewNoSideEffects(mode domain.Mode, cfg WebsiteConfig) (siteView, SiteResult) {
	row := lookupWebsiteRow(cfg.Domain)
	req := stackRequest(cfg, row)
	owner := siteOwner(cfg)
	eff := domain.ResolveStack(mode, req, true)
	version := sitePHPVersion(cfg, owner, eff.Backend)
	eff = domain.ResolveStack(mode, req, cgiHandlerAvailable(version))
	return siteView{}, SiteResult{Domain: cfg.Domain, Requested: req, Effective: eff}
}

func websiteConfigFromRow(row *models.Website) WebsiteConfig {
	return WebsiteConfig{
		Domain:        row.Domain,
		RootPath:      row.RootPath,
		OwnerUsername: row.OwnerUsername,
		PHPVersion:    row.PHPVersion,
		SiteType:      row.SiteType,
		ProxyPort:     row.ProxyPort,
		ProxyHost:     row.ProxyHost,
		TemplateID:    row.TemplateID,
	}
}

// RemoveSite deletes every web server file for a domain (site or panel service vhost).
func (w *WebStackService) RemoveSite(domainName string) error {
	domainName = strings.TrimSpace(domainName)
	if domainName == "" || strings.ContainsAny(domainName, "/\\") {
		return fmt.Errorf("invalid domain")
	}
	w.mu.Lock()
	defer w.mu.Unlock()

	t := newFSTxn()
	for _, p := range []string{
		paths.NginxEnabled(domainName), paths.NginxAvailable(domainName),
		paths.ApacheEnabled(domainName), paths.ApacheAvailable(domainName),
	} {
		t.Remove(p)
	}
	_ = os.Remove(filepath.Join(nginxCustomDir, domainName+".conf"))
	_ = os.Remove(filepath.Join(apacheCustomDir, domainName+".conf"))
	if err := w.removeSiteServices(t, domainName); err != nil {
		t.Rollback()
		return err
	}
	w.unregisterService(domainName)
	if !t.dirty {
		return nil
	}
	return w.verifyAndReload(CurrentMode(), t)
}

// ── Test + reload ─────────────────────────────────────────────────────────────

func nginxInstalled() bool   { _, err := exec.LookPath("nginx"); return err == nil }
func apacheInstalled() bool  { _, err := exec.LookPath("apache2ctl"); return err == nil }
func varnishInstalled() bool { _, err := exec.LookPath("varnishd"); return err == nil }

func testNginx() error {
	if out, err := exec.Command("nginx", "-t").CombinedOutput(); err != nil {
		return fmt.Errorf("nginx -t failed: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

func testApache() error {
	if out, err := exec.Command("apache2ctl", "configtest").CombinedOutput(); err != nil {
		return fmt.Errorf("apache2ctl configtest failed: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

func testVarnish() error {
	if out, err := exec.Command("varnishd", "-C", "-f", varnishVCL).CombinedOutput(); err != nil {
		return fmt.Errorf("varnish VCL failed to compile: %s", lastLines(string(out), 8))
	}
	return nil
}

func lastLines(s string, n int) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, "\n")
}

func unitActive(unit string) bool {
	return exec.Command("systemctl", "is-active", "--quiet", unit).Run() == nil
}

func reloadUnit(unit string) error {
	if !unitActive(unit) {
		return exec.Command("systemctl", "start", unit).Run()
	}
	var before map[string]bool
	if unit == "nginx" {
		before = nginxWorkerPIDs()
	}
	if err := exec.Command("systemctl", "reload", unit).Run(); err != nil {
		return exec.Command("systemctl", "restart", unit).Run()
	}
	if unit == "nginx" {
		waitNginxWorkers(before)
	}
	return nil
}

func nginxWorkerPIDs() map[string]bool {
	out, _ := exec.Command("pgrep", "-f", "nginx: worker process").Output()
	pids := map[string]bool{}
	for _, p := range strings.Fields(string(out)) {
		pids[p] = true
	}
	return pids
}

// waitNginxWorkers: `nginx -s reload` returns before the new workers run, so a request sent
// right after an apply could still meet the old config. Wait (up to 2s) for a new worker.
func waitNginxWorkers(before map[string]bool) {
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		for p := range nginxWorkerPIDs() {
			if !before[p] {
				time.Sleep(50 * time.Millisecond) // let the old workers close their listeners
				return
			}
		}
		time.Sleep(25 * time.Millisecond)
	}
}

// verifyAndReload: nginx -t → apache configtest → reload nginx → apache → varnish
// (only the daemons the mode runs and whose files changed).
func (w *WebStackService) verifyAndReload(mode domain.Mode, t *fsTxn) error {
	nginxChanged := mode.HasNginx() && t.Changed("/etc/nginx/")
	apacheChanged := mode.HasApache() && t.Changed("/etc/apache2/")
	varnishChanged := mode.HasVarnish() && t.Changed("/etc/varnish/")

	if nginxChanged {
		if err := testNginx(); err != nil {
			return err
		}
	}
	if apacheChanged {
		if err := testApache(); err != nil {
			return err
		}
	}
	if varnishChanged {
		if err := testVarnish(); err != nil {
			return err
		}
	}
	if nginxChanged {
		if err := reloadUnit("nginx"); err != nil {
			return fmt.Errorf("nginx reload failed: %w", err)
		}
	}
	if apacheChanged {
		if err := reloadUnit("apache2"); err != nil {
			return fmt.Errorf("apache reload failed: %w", err)
		}
	}
	if varnishChanged {
		_ = reloadUnit("varnish")
	}
	return nil
}

// ── Site inventory ────────────────────────────────────────────────────────────

var servicePrefixes = []string{"webmail.", "cpanel.", "ftp.", "imap.", "pop.", "mail.", "autoconfig.", "autodiscover.", "akpanel-"}

func isServiceVhostName(name string) bool {
	if name == "default" || name == "default-ssl" || strings.HasPrefix(name, "000-") || !strings.Contains(name, ".") {
		return true
	}
	for _, p := range servicePrefixes {
		if strings.HasPrefix(name, p) {
			return true
		}
	}
	return false
}

var (
	ownerMarkerRe = regexp.MustCompile(`(?m)^# akpanel-owner: (\S+)`)
	rootLineRe    = regexp.MustCompile(`(?m)^\s*(?:root|DocumentRoot)\s+([^;\s]+);?`)
)

// allSites returns every customer site. The websites table is the source of truth; sites
// that only exist as vhost files or as an account's main domain get a row on the way, so
// per-domain choices have somewhere to live.
func (w *WebStackService) allSites() []WebsiteConfig {
	seen := map[string]bool{}
	var out []WebsiteConfig

	if panelOrm() != nil {
		var rows []models.Website
		if err := panelOrm().Query().Where("status != ?", "deleted").Find(&rows); err == nil {
			for i := range rows {
				if rows[i].Domain == "" || seen[rows[i].Domain] {
					continue
				}
				seen[rows[i].Domain] = true
				out = append(out, websiteConfigFromRow(&rows[i]))
			}
		}
	}

	if data, err := os.ReadFile(paths.UsersJSON()); err == nil {
		var users []UserAccount
		if json.Unmarshal(data, &users) == nil {
			for _, u := range users {
				if u.MainDomain == "" || seen[u.MainDomain] {
					continue
				}
				seen[u.MainDomain] = true
				cfg := WebsiteConfig{
					Domain: u.MainDomain, RootPath: paths.UserDomainRoot(u.Username, u.MainDomain),
					OwnerUsername: u.Username, PHPVersion: u.PHPVersion, SiteType: domain.SiteTypePHP,
					ServerEngine: u.WebEngine, TemplateID: "custom",
				}
				upsertWebsiteRecord(cfg)
				out = append(out, cfg)
			}
		}
	}

	for _, dir := range []string{paths.NginxAvailableDir, paths.ApacheAvailableDir} {
		files, _ := filepath.Glob(filepath.Join(dir, "*.conf"))
		for _, f := range files {
			name := strings.TrimSuffix(filepath.Base(f), ".conf")
			if name == "" || seen[name] || isServiceVhostName(name) || w.isRegisteredService(name) {
				continue
			}
			b, err := os.ReadFile(f)
			if err != nil {
				continue
			}
			body := string(b)
			if strings.Contains(body, "kind=") && strings.Contains(body, "service.conf.tmpl") {
				continue
			}
			seen[name] = true
			cfg := WebsiteConfig{Domain: name, SiteType: domain.SiteTypePHP, TemplateID: "custom"}
			if m := ownerMarkerRe.FindStringSubmatch(body); m != nil {
				cfg.OwnerUsername = m[1]
			}
			if m := rootLineRe.FindStringSubmatch(body); m != nil {
				cfg.RootPath = m[1]
			}
			if cfg.OwnerUsername == "" {
				cfg.OwnerUsername = linuxAccountFromPath(cfg.RootPath)
			}
			if strings.Contains(body, "proxy_pass http://127.0.0.1:8081") {
				cfg.ServerEngine = "apache"
			}
			upsertWebsiteRecord(cfg)
			out = append(out, cfg)
		}
	}

	sort.Slice(out, func(i, j int) bool { return out[i].Domain < out[j].Domain })
	return out
}

// upsertWebsiteRecord creates a websites row for a vhost that has none (client add-on
// domains, account main domains, pre-database installs).
func upsertWebsiteRecord(cfg WebsiteConfig) {
	if panelOrm() == nil || cfg.Domain == "" || lookupWebsiteRow(cfg.Domain) != nil {
		return
	}
	owner := siteOwner(cfg)
	if owner == "" {
		owner = "root"
	}
	backend, varnish := domain.ParseBackend(cfg.Backend)
	if cfg.Backend == "" {
		backend, varnish = domain.ParseBackend(cfg.ServerEngine)
	}
	engine := string(backend)
	if engine == "" {
		engine = "default"
	}
	siteType := cfg.SiteType
	if siteType == "" {
		siteType = domain.SiteTypePHP
	}
	_ = panelOrm().Query().Create(&models.Website{
		Domain: cfg.Domain, OwnerUsername: owner, Status: "active",
		ServerEngine: engine, Backend: string(backend), Varnish: varnish,
		PHPHandler: string(domain.ParsePHPHandler(cfg.PHPHandler)),
		TemplateID: cfg.TemplateID, PHPVersion: cfg.PHPVersion, SiteType: siteType,
		ProxyPort: cfg.ProxyPort, RootPath: cfg.RootPath,
	})
}

// UpsertWebsiteRecord is the exported form for services outside the provisioning orchestrator.
func UpsertWebsiteRecord(cfg WebsiteConfig) { upsertWebsiteRecord(cfg) }

// RebuildAll re-renders every site and panel service vhost for the current mode.
func (w *WebStackService) RebuildAll() (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	mode := CurrentMode()
	modsChanged := apacheInstalled() && mode.HasApache() && applyApacheModules(mode)
	t := newFSTxn()
	n, err := w.renderEverything(t, mode, nil)
	if err != nil {
		t.Rollback()
		return 0, err
	}
	if err := w.verifyAndReload(mode, t); err != nil {
		t.Rollback()
		return 0, err
	}
	if modsChanged && !t.Changed("/etc/apache2/") {
		_ = reloadUnit("apache2")
	}
	return n, nil
}

func (w *WebStackService) renderEverything(t *fsTxn, mode domain.Mode, logf func(string)) (int, error) {
	if err := w.renderGlobals(t, mode); err != nil {
		return 0, err
	}
	if err := w.renderServices(t, mode); err != nil {
		return 0, err
	}
	count := 0
	for _, cfg := range w.allSites() {
		res, err := w.renderSite(t, mode, cfg)
		if err != nil {
			return count, fmt.Errorf("%s: %w", cfg.Domain, err)
		}
		count++
		if logf != nil {
			logf(fmt.Sprintf("%s → %s%s", cfg.Domain, describeEffective(res.Effective), noteSuffix(res.Effective)))
		}
	}
	return count, nil
}

func describeEffective(e domain.EffectiveStack) string {
	switch e.SiteType {
	case domain.SiteTypeProxy:
		return fmt.Sprintf("proxy %s via %s", domain.ProxyAddr(e.ProxyHost, e.ProxyPort), e.Backend)
	case domain.SiteTypeStatic:
		s := "static via " + string(e.Backend)
		if e.Varnish {
			s += " + varnish"
		}
		return s
	}
	s := string(e.Backend)
	if e.Backend == domain.BackendApache {
		s += "/" + string(e.PHPHandler)
	} else {
		s += "/fpm"
	}
	if e.Varnish {
		s += " + varnish"
	}
	return s
}

func noteSuffix(e domain.EffectiveStack) string {
	if len(e.Notes) == 0 {
		return ""
	}
	return " (" + strings.Join(e.Notes, "; ") + ")"
}

// ── Globals (ports, http-level confs, VCL) ────────────────────────────────────

type globalView struct {
	Mode            domain.Mode
	ApachePublic    bool
	BehindProxy     bool
	ApacheAddr      string
	ApachePort      int
	NginxOriginPort int
	VarnishAddr     string
	DefaultTTL      string
	Hostname        string
	ExtraListen     []string
}

func panelHostname() string {
	if out, err := exec.Command("hostname", "-f").Output(); err == nil {
		if h := strings.TrimSpace(string(out)); h != "" {
			return h
		}
	}
	return "localhost"
}

func (w *WebStackService) renderGlobals(t *fsTxn, mode domain.Mode) error {
	g := globalView{
		Mode:            mode,
		ApachePublic:    mode == domain.ModeApache,
		BehindProxy:     mode != domain.ModeApache,
		ApacheAddr:      domain.ApacheBackendAddr,
		ApachePort:      domain.ApacheBackendPort,
		NginxOriginPort: domain.NginxBackendPort,
		VarnishAddr:     domain.VarnishListenAddr,
		DefaultTTL:      "2m",
		Hostname:        panelHostname(),
	}
	if nginxInstalled() {
		for _, f := range []struct{ tmpl, dest string }{
			{"global.conf.tmpl", nginxGlobalConf},
			{"proxy.conf.tmpl", nginxProxySnippet},
		} {
			conf, err := templates.Render("nginx", f.tmpl, g)
			if err != nil {
				return err
			}
			if err := t.Write(f.dest, conf, 0644); err != nil {
				return err
			}
		}
		ensureNginxFastcgiParams()
	}
	if err := writeSystemRedirects(t, LoadSystemRedirects()); err != nil {
		return err
	}
	if apacheInstalled() {
		if mode == domain.ModeApache {
			g.ExtraListen = []string{internalRoundcubeAddr, internalPMAAddr}
		}
		ports, err := templates.Render("apache", "ports.conf.tmpl", g)
		if err != nil {
			return err
		}
		if err := t.Write(apachePortsConf, ports, 0644); err != nil {
			return err
		}
		global, err := templates.Render("apache", "global.conf.tmpl", g)
		if err != nil {
			return err
		}
		if err := t.Write(apacheGlobalConf, global, 0644); err != nil {
			return err
		}
		if err := t.Symlink("../conf-available/akpanel.conf", "/etc/apache2/conf-enabled/akpanel.conf"); err != nil {
			return err
		}
		t.Remove("/etc/apache2/sites-enabled/000-default.conf")
		t.Remove("/etc/apache2/sites-enabled/default-ssl.conf")
		t.Remove("/etc/apache2/conf-enabled/servername.conf")
	}
	if varnishInstalled() && mode.HasVarnish() {
		vcl, err := templates.Render("varnish", "default.vcl.tmpl", g)
		if err != nil {
			return err
		}
		if err := t.Write(varnishVCL, vcl, 0644); err != nil {
			return err
		}
		dropIn := fmt.Sprintf(`# Managed by AKpanel — Varnish listens on loopback only; nginx is the public front.
[Service]
ExecStart=
ExecStart=/usr/sbin/varnishd -j unix,user=vcache -F -a %s -T localhost:6082 -f %s -S /etc/varnish/secret -s malloc,256m
`, domain.VarnishListenAddr, varnishVCL)
		if err := t.Write(varnishDropIn, dropIn, 0644); err != nil {
			return err
		}
	}
	return nil
}

// apacheModules returns the modules the mode needs.
func apacheModules(mode domain.Mode) (enable, disable []string) {
	enable = []string{"proxy", "proxy_fcgi", "proxy_http", "proxy_wstunnel", "rewrite", "headers", "setenvif", "alias", "mpm_event"}
	if mode == domain.ModeApache {
		enable = append(enable, "ssl")
		disable = append(disable, "remoteip")
	} else {
		enable = append(enable, "remoteip")
	}
	if _, err := os.Stat("/usr/lib/apache2/modules/mod_fcgid.so"); err == nil {
		enable = append(enable, "fcgid")
	}
	if _, err := os.Stat("/usr/lib/apache2/suexec"); err == nil {
		enable = append(enable, "suexec")
	}
	return enable, disable
}

func enabledApacheModules() string {
	entries, _ := os.ReadDir("/etc/apache2/mods-enabled")
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	return strings.Join(names, ",")
}

// applyApacheModules enables what the mode needs; returns true when the module set changed.
func applyApacheModules(mode domain.Mode) bool {
	before := enabledApacheModules()
	enable, disable := apacheModules(mode)
	// mod_php needs prefork; every AKpanel handler runs on event.
	for _, m := range []string{"php7.4", "php8.0", "php8.1", "php8.2", "php8.3", "php8.4", "php8.5", "mpm_prefork", "mpm_worker"} {
		if _, err := os.Stat("/etc/apache2/mods-enabled/" + m + ".load"); err == nil {
			_ = exec.Command("a2dismod", "-q", "-f", m).Run()
		}
	}
	for _, m := range disable {
		_ = exec.Command("a2dismod", "-q", "-f", m).Run()
	}
	for _, m := range enable {
		_ = exec.Command("a2enmod", "-q", m).Run()
	}
	EnsureSuexecDocroot()
	return enabledApacheModules() != before
}

// ── Mode switch ───────────────────────────────────────────────────────────────

// ModeSwitchResult is returned to the UI.
type ModeSwitchResult struct {
	From  domain.Mode `json:"from"`
	To    domain.Mode `json:"to"`
	Sites int         `json:"sites"`
	Log   []string    `json:"log"`
}

func modePrerequisites(mode domain.Mode) error {
	var missing []string
	if mode.HasNginx() && !nginxInstalled() {
		missing = append(missing, "nginx")
	}
	if mode.HasApache() && !apacheInstalled() {
		missing = append(missing, "apache2")
	}
	if mode.HasVarnish() && !varnishInstalled() {
		missing = append(missing, "varnish")
	}
	if len(missing) > 0 {
		return fmt.Errorf("mode %s needs %s installed", mode, strings.Join(missing, ", "))
	}
	return nil
}

// ApplyMode switches the whole server to mode: config files for every daemon, every site
// and panel vhost re-rendered, configs tested, then services started/stopped. Any failure
// restores the previous files and services.
func (w *WebStackService) ApplyMode(target domain.Mode) (ModeSwitchResult, error) {
	res := ModeSwitchResult{To: target}
	logf := func(s string) { res.Log = append(res.Log, s) }
	if err := modePrerequisites(target); err != nil {
		return res, err
	}

	w.mu.Lock()
	defer w.mu.Unlock()

	from := CurrentMode()
	res.From = from
	logf(fmt.Sprintf("switching %s → %s", from, target))

	t := newFSTxn()
	if err := t.Write(paths.ServerProfileConf(), string(target)+"\n", 0644); err != nil {
		return res, err
	}
	if apacheInstalled() {
		applyApacheModules(target)
	}
	n, err := w.renderEverything(t, target, logf)
	if err != nil {
		t.Rollback()
		return res, err
	}
	res.Sites = n

	// Test everything the new mode runs before touching any daemon.
	if target.HasApache() {
		if err := testApache(); err != nil {
			t.Rollback()
			return res, err
		}
	}
	if target.HasNginx() {
		if err := testNginx(); err != nil {
			t.Rollback()
			return res, err
		}
	}
	if target.HasVarnish() {
		if err := testVarnish(); err != nil {
			t.Rollback()
			return res, err
		}
	}
	logf("config tests passed")

	if err := applyModeServices(target, logf); err != nil {
		logf("service switch failed: " + err.Error() + " — restoring " + string(from))
		t.Rollback()
		if apacheInstalled() {
			applyApacheModules(from)
		}
		_ = applyModeServices(from, logf)
		return res, err
	}
	syncInstallConfMode(target)
	logf("done")
	return res, nil
}

// applyModeServices stops what the mode does not use first (so ports are free), then
// (re)starts what it does use.
func applyModeServices(mode domain.Mode, logf func(string)) error {
	_ = exec.Command("systemctl", "daemon-reload").Run()

	if !mode.HasVarnish() && varnishInstalled() {
		disableNow("varnish")
		_ = exec.Command("systemctl", "reset-failed", "varnish").Run()
		logf("varnish stopped")
	}
	if !mode.HasNginx() && nginxInstalled() {
		disableNow("nginx")
		logf("nginx stopped")
	}
	if !mode.HasApache() && apacheInstalled() {
		disableNow("apache2")
		logf("apache2 stopped")
	}

	start := func(unit string) error {
		_ = exec.Command("systemctl", "enable", unit).Run()
		if out, err := exec.Command("systemctl", "restart", unit).CombinedOutput(); err != nil {
			journal, _ := exec.Command("journalctl", "-u", unit, "-n", "15", "--no-pager").CombinedOutput()
			return fmt.Errorf("%s failed to start: %s %s", unit, strings.TrimSpace(string(out)), lastLines(string(journal), 6))
		}
		logf(unit + " running")
		return nil
	}
	// Backends first, then the front that proxies to them.
	if mode.HasApache() {
		if err := start("apache2"); err != nil {
			return err
		}
	}
	if mode.HasVarnish() {
		if err := start("varnish"); err != nil {
			return err
		}
		// varnishd returns before its worker child binds the port.
		if err := waitTCP(domain.VarnishListenAddr, 20*time.Second); err != nil {
			return fmt.Errorf("varnish is not listening on %s: %w", domain.VarnishListenAddr, err)
		}
	}
	if mode.HasNginx() {
		if err := start("nginx"); err != nil {
			return err
		}
	}
	return nil
}

func waitTCP(addr string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		c, err := net.DialTimeout("tcp", addr, time.Second)
		if err == nil {
			_ = c.Close()
			return nil
		}
		if time.Now().After(deadline) {
			return err
		}
		time.Sleep(250 * time.Millisecond)
	}
}

func syncInstallConfMode(mode domain.Mode) {
	data, err := os.ReadFile(paths.InstallConf())
	if err != nil {
		return
	}
	var conf map[string]any
	if json.Unmarshal(data, &conf) != nil {
		return
	}
	components, _ := conf["components"].(map[string]any)
	if components == nil {
		components = map[string]any{}
	}
	components["webserver_profile"] = string(mode)
	components["varnish"] = mode.HasVarnish()
	conf["components"] = components
	if out, err := json.MarshalIndent(conf, "", "  "); err == nil {
		_ = os.WriteFile(paths.InstallConf(), out, 0644)
	}
}

// SaveCustomIncludes writes a domain's custom nginx/Apache include files and re-applies the
// site; if the result does not pass the syntax tests the previous includes come back.
func (w *WebStackService) SaveCustomIncludes(domainName, nginxCustom, apacheCustom string) error {
	if domainName == "" || strings.ContainsAny(domainName, "/\\") {
		return fmt.Errorf("invalid domain")
	}
	row := lookupWebsiteRow(domainName)
	if row == nil {
		return fmt.Errorf("website %s not found", domainName)
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	mode := CurrentMode()
	t := newFSTxn()
	if err := t.Write(filepath.Join(nginxCustomDir, domainName+".conf"), nginxCustom, 0644); err != nil {
		return err
	}
	if err := t.Write(filepath.Join(apacheCustomDir, domainName+".conf"), apacheCustom, 0644); err != nil {
		return err
	}
	if _, err := w.renderSite(t, mode, websiteConfigFromRow(row)); err != nil {
		t.Rollback()
		return err
	}
	if err := w.verifyAndReload(mode, t); err != nil {
		t.Rollback()
		return err
	}
	return nil
}

// WebsiteConfigFromRow is the exported form for the provisioning package.
func WebsiteConfigFromRow(row *models.Website) WebsiteConfig { return websiteConfigFromRow(row) }
