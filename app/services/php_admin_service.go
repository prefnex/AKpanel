package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"goravel/app/models"
	"goravel/app/paths"
)

// Admin-side PHP management: php.ini settings, the shared FPM pool, extension switches,
// FPM service control and version removal. Every entry point validates the version
// first — it is used to build paths under /etc/php.

func requireVersion(version string) error {
	if !paths.IsPHPVersionString(version) {
		return fmt.Errorf("invalid PHP version %q", version)
	}
	return nil
}

// phpSAPIs are the php.ini flavours the panel edits.
var phpSAPIs = map[string]bool{"fpm": true, "cli": true}

func phpIniPath(version, sapi string) (string, error) {
	if err := requireVersion(version); err != nil {
		return "", err
	}
	if sapi == "" {
		sapi = "fpm"
	}
	if !phpSAPIs[sapi] {
		return "", fmt.Errorf("invalid php.ini target %q", sapi)
	}
	return fmt.Sprintf("/etc/php/%s/%s/php.ini", version, sapi), nil
}

// ---------------------------------------------------------------- php.ini settings

// IniSettingDef describes one php.ini directive the settings page manages.
type IniSettingDef struct {
	Key     string   `json:"key"`
	Group   string   `json:"group"`
	Label   string   `json:"label"`
	Help    string   `json:"help"`
	Kind    string   `json:"kind"` // size | int | bool | choice | timezone
	Options []string `json:"options,omitempty"`
	Unit    string   `json:"unit,omitempty"`
	// BoolOn/BoolOff are how the value is written (On/Off for core, 1/0 for opcache).
	BoolOn  string `json:"-"`
	BoolOff string `json:"-"`
}

var phpIniDefs = []IniSettingDef{
	{Key: "memory_limit", Group: "Resources", Label: "Memory limit", Help: "Most memory one script may use. -1 = no limit (not recommended).", Kind: "size", Options: []string{"64M", "128M", "256M", "512M", "768M", "1G", "2G", "-1"}},
	{Key: "max_execution_time", Group: "Resources", Label: "Max execution time", Help: "Seconds a script may run. 0 = no limit.", Kind: "int", Unit: "s", Options: []string{"30", "60", "120", "300", "600", "0"}},
	{Key: "max_input_time", Group: "Resources", Label: "Max input time", Help: "Seconds allowed to parse request data (uploads). -1 = use max_execution_time.", Kind: "int", Unit: "s", Options: []string{"-1", "60", "120", "300", "600"}},
	{Key: "max_input_vars", Group: "Resources", Label: "Max input vars", Help: "How many GET/POST/COOKIE variables are accepted. Large forms (WooCommerce, menus) need more.", Kind: "int", Options: []string{"1000", "3000", "5000", "10000"}},

	{Key: "upload_max_filesize", Group: "Uploads", Label: "Upload max file size", Help: "Largest single uploaded file. Must not exceed post_max_size.", Kind: "size", Options: []string{"2M", "8M", "32M", "64M", "128M", "256M", "512M", "1G", "2G"}},
	{Key: "post_max_size", Group: "Uploads", Label: "Post max size", Help: "Largest whole request body. Keep it ≥ upload_max_filesize.", Kind: "size", Options: []string{"8M", "32M", "64M", "128M", "256M", "512M", "1G", "2G"}},
	{Key: "max_file_uploads", Group: "Uploads", Label: "Max files per request", Kind: "int", Options: []string{"20", "50", "100", "200"}},
	{Key: "file_uploads", Group: "Uploads", Label: "Allow file uploads", Kind: "bool", BoolOn: "On", BoolOff: "Off"},

	{Key: "display_errors", Group: "Errors", Label: "Display errors", Help: "Show errors in the page. Keep off on production sites.", Kind: "bool", BoolOn: "On", BoolOff: "Off"},
	{Key: "log_errors", Group: "Errors", Label: "Log errors", Kind: "bool", BoolOn: "On", BoolOff: "Off"},
	{Key: "error_reporting", Group: "Errors", Label: "Error reporting level", Kind: "choice", Options: []string{
		"E_ALL & ~E_DEPRECATED & ~E_STRICT",
		"E_ALL & ~E_NOTICE & ~E_DEPRECATED & ~E_STRICT",
		"E_ALL",
		"E_ERROR | E_WARNING | E_PARSE",
	}},

	{Key: "date.timezone", Group: "Behaviour", Label: "Default timezone", Kind: "timezone"},
	{Key: "allow_url_fopen", Group: "Behaviour", Label: "allow_url_fopen", Help: "Let file functions open http:// URLs.", Kind: "bool", BoolOn: "On", BoolOff: "Off"},
	{Key: "short_open_tag", Group: "Behaviour", Label: "Short open tag (<?)", Kind: "bool", BoolOn: "On", BoolOff: "Off"},
	{Key: "expose_php", Group: "Behaviour", Label: "Expose PHP version header", Help: "Adds X-Powered-By. Off hides the version from visitors.", Kind: "bool", BoolOn: "On", BoolOff: "Off"},
	{Key: "session.gc_maxlifetime", Group: "Behaviour", Label: "Session lifetime", Kind: "int", Unit: "s", Options: []string{"1440", "3600", "7200", "28800", "86400"}},

	{Key: "opcache.enable", Group: "OPcache", Label: "Enable OPcache", Help: "Caches compiled scripts in memory. Big speed win; keep on.", Kind: "bool", BoolOn: "1", BoolOff: "0"},
	{Key: "opcache.memory_consumption", Group: "OPcache", Label: "OPcache memory", Kind: "int", Unit: "MB", Options: []string{"64", "128", "256", "512"}},
	{Key: "opcache.max_accelerated_files", Group: "OPcache", Label: "Max cached files", Kind: "int", Options: []string{"10000", "20000", "50000", "100000"}},
	{Key: "opcache.validate_timestamps", Group: "OPcache", Label: "Check files for changes", Help: "Off is fastest but code changes need an FPM reload.", Kind: "bool", BoolOn: "1", BoolOff: "0"},
	{Key: "opcache.revalidate_freq", Group: "OPcache", Label: "Revalidate every", Kind: "int", Unit: "s", Options: []string{"0", "2", "60", "300"}},
}

var (
	iniSizeRe     = regexp.MustCompile(`^(-1|[0-9]{1,6}[KMGkmg]?)$`)
	iniIntRe      = regexp.MustCompile(`^-?[0-9]{1,9}$`)
	iniTZRe       = regexp.MustCompile(`^[A-Za-z_]+(/[A-Za-z0-9_+\-]+){0,2}$`)
	iniErrLevelRe = regexp.MustCompile(`^[A-Z_ &|~^()0-9]{1,120}$`)
)

func iniDef(key string) *IniSettingDef {
	for i := range phpIniDefs {
		if phpIniDefs[i].Key == key {
			return &phpIniDefs[i]
		}
	}
	return nil
}

// normaliseIniValue validates value for def and returns what is written to php.ini.
func normaliseIniValue(def *IniSettingDef, value string) (string, error) {
	v := strings.TrimSpace(value)
	bad := fmt.Errorf("invalid value %q for %s", value, def.Key)
	switch def.Kind {
	case "size":
		if !iniSizeRe.MatchString(v) {
			return "", bad
		}
		return strings.ToUpper(v), nil
	case "int":
		if !iniIntRe.MatchString(v) {
			return "", bad
		}
		return v, nil
	case "bool":
		switch strings.ToLower(v) {
		case "1", "on", "true", "yes":
			return def.BoolOn, nil
		case "0", "off", "false", "no", "":
			return def.BoolOff, nil
		}
		return "", bad
	case "choice":
		if !iniErrLevelRe.MatchString(v) {
			return "", bad
		}
		return v, nil
	case "timezone":
		if v == "" || !iniTZRe.MatchString(v) {
			return "", bad
		}
		if _, err := os.Stat(filepath.Join("/usr/share/zoneinfo", v)); err != nil && v != "UTC" {
			return "", fmt.Errorf("unknown timezone %q", v)
		}
		return v, nil
	}
	return "", bad
}

// effectiveIni asks the PHP binary for the values it actually runs with (php.ini plus the
// SAPI's conf.d), so OPcache and distro overrides show correctly.
func effectiveIni(version, sapi string) map[string]string {
	out := map[string]string{}
	if !paths.PHPCLIInstalled(version) {
		return out
	}
	ini, err := phpIniPath(version, sapi)
	if err != nil {
		return out
	}
	cmd := exec.Command("/usr/bin/php"+version, "-c", ini, "-r", "echo json_encode(ini_get_all(null, false));")
	cmd.Env = append(os.Environ(), "PHP_INI_SCAN_DIR="+fmt.Sprintf("/etc/php/%s/%s/conf.d", version, sapi))
	b, err := cmd.Output()
	if err != nil {
		return out
	}
	var raw map[string]any
	if json.Unmarshal(b, &raw) != nil {
		return out
	}
	for k, v := range raw {
		switch t := v.(type) {
		case string:
			out[k] = t
		case nil:
			out[k] = ""
		default:
			out[k] = fmt.Sprint(t)
		}
	}
	return out
}

// IniSettingValue is one directive's current value for the settings page.
type IniSettingValue struct {
	IniSettingDef
	Value string `json:"value"`
}

// GetIniSettings returns the managed directives with their current values.
func (p *PHPManagerService) GetIniSettings(version, sapi string) ([]IniSettingValue, error) {
	path, err := phpIniPath(version, sapi)
	if err != nil {
		return nil, err
	}
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("PHP %s has no %s php.ini: %w", version, sapi, err)
	}
	eff := effectiveIni(version, sapi)
	res := make([]IniSettingValue, 0, len(phpIniDefs))
	for _, d := range phpIniDefs {
		v, ok := eff[d.Key]
		if !ok {
			v = activeIniValue(string(content), d.Key)
		}
		if d.Kind == "bool" {
			if isTruthy(v) {
				v = "1"
			} else {
				v = "0"
			}
		}
		if d.Key == "error_reporting" {
			v = errorReportingName(v, activeIniValue(string(content), d.Key))
		}
		res = append(res, IniSettingValue{IniSettingDef: d, Value: v})
	}
	return res, nil
}

func isTruthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "on", "true", "yes":
		return true
	}
	return false
}

// errorReportingName prefers the constant expression from php.ini over the integer PHP reports.
func errorReportingName(effective, fromFile string) string {
	if fromFile != "" {
		return fromFile
	}
	return effective
}

func iniLineRe(key string) *regexp.Regexp {
	return regexp.MustCompile(`(?m)^[ \t]*(;?)[ \t]*` + regexp.QuoteMeta(key) + `[ \t]*=[ \t]*(.*?)[ \t]*$`)
}

// activeIniValue returns the uncommented value of key ("" if only commented or missing).
func activeIniValue(content, key string) string {
	for _, m := range iniLineRe(key).FindAllStringSubmatch(content, -1) {
		if m[1] == "" {
			return strings.Trim(m[2], `"`)
		}
	}
	return ""
}

// setIniDirective rewrites the active line for key, else uncomments the first commented
// example, else appends the directive.
func setIniDirective(content, key, value string) string {
	re := iniLineRe(key)
	line := fmt.Sprintf("%s = %s", key, value)
	locs := re.FindAllStringSubmatchIndex(content, -1)
	target := -1
	for i, l := range locs {
		if l[3]-l[2] == 0 { // group 1 (the ';') is empty → active line
			target = i
			break
		}
	}
	if target < 0 && len(locs) > 0 {
		target = 0
	}
	if target >= 0 {
		l := locs[target]
		return content[:l[0]] + line + content[l[1]:]
	}
	if !strings.HasSuffix(content, "\n") {
		content += "\n"
	}
	return content + "\n; Added by AKpanel\n" + line + "\n"
}

// checkIniSyntax loads candidate php.ini content with the version's CLI binary.
func checkIniSyntax(version, content string) error {
	if !paths.PHPCLIInstalled(version) {
		return nil
	}
	tmp, err := os.CreateTemp("", "akpanel-php-*.ini")
	if err != nil {
		return nil
	}
	defer os.Remove(tmp.Name())
	_, _ = tmp.WriteString(content)
	_ = tmp.Close()
	cmd := exec.Command("/usr/bin/php"+version, "-n", "-c", tmp.Name(), "-r", "exit(0);")
	out, _ := cmd.CombinedOutput()
	for _, l := range strings.Split(string(out), "\n") {
		if strings.Contains(l, "syntax error") || strings.Contains(l, "PHP:  ") {
			return fmt.Errorf("php.ini has errors: %s", strings.TrimSpace(strings.ReplaceAll(l, tmp.Name(), "php.ini")))
		}
	}
	return nil
}

func writeIniWithBackup(path, content string) error {
	if old, err := os.ReadFile(path); err == nil {
		_ = os.WriteFile(path+".akpanel.bak", old, 0644)
	}
	return os.WriteFile(path, []byte(content), 0644)
}

func reloadFPM(version string) {
	if paths.PHPFPMInstalled(version) {
		_ = exec.Command("systemctl", "reload-or-restart", fmt.Sprintf("php%s-fpm", version)).Run()
	}
}

// SaveIniSettings validates and writes managed directives to each target php.ini.
func (p *PHPManagerService) SaveIniSettings(version string, sapis []string, settings map[string]string) error {
	if err := requireVersion(version); err != nil {
		return err
	}
	if len(sapis) == 0 {
		sapis = []string{"fpm"}
	}
	clean := map[string]string{}
	for k, v := range settings {
		d := iniDef(k)
		if d == nil {
			return fmt.Errorf("%s cannot be set here; use the raw php.ini editor", k)
		}
		nv, err := normaliseIniValue(d, v)
		if err != nil {
			return err
		}
		clean[k] = nv
	}
	if up, ok := clean["upload_max_filesize"]; ok {
		if post, ok2 := clean["post_max_size"]; ok2 && iniBytes(post) >= 0 && iniBytes(up) > iniBytes(post) {
			return fmt.Errorf("upload_max_filesize (%s) is larger than post_max_size (%s): uploads would fail", up, post)
		}
	}

	keys := make([]string, 0, len(clean))
	for k := range clean {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, sapi := range sapis {
		path, err := phpIniPath(version, sapi)
		if err != nil {
			return err
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("cannot read %s: %w", path, err)
		}
		content := string(b)
		for _, k := range keys {
			content = setIniDirective(content, k, clean[k])
		}
		if err := checkIniSyntax(version, content); err != nil {
			return err
		}
		if err := writeIniWithBackup(path, content); err != nil {
			return fmt.Errorf("failed to save %s: %w", path, err)
		}
	}
	reloadFPM(version)
	return nil
}

// iniBytes converts "128M" to bytes; -1 for unlimited.
func iniBytes(v string) int64 {
	v = strings.TrimSpace(strings.ToUpper(v))
	if v == "" {
		return 0
	}
	if v == "-1" {
		return -1
	}
	mult := int64(1)
	switch v[len(v)-1] {
	case 'K':
		mult = 1 << 10
	case 'M':
		mult = 1 << 20
	case 'G':
		mult = 1 << 30
	}
	n, _ := strconv.ParseInt(strings.TrimRight(v, "KMG"), 10, 64)
	return n * mult
}

// GetRawIni reads a raw php.ini (sapi: fpm | cli).
func (p *PHPManagerService) GetRawIni(version, sapi string) (string, error) {
	path, err := phpIniPath(version, sapi)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// SaveRawIni checks the syntax, keeps a .akpanel.bak copy, writes and reloads FPM.
func (p *PHPManagerService) SaveRawIni(version, sapi, content string) error {
	path, err := phpIniPath(version, sapi)
	if err != nil {
		return err
	}
	if strings.TrimSpace(content) == "" {
		return fmt.Errorf("refusing to save an empty php.ini")
	}
	if err := checkIniSyntax(version, content); err != nil {
		return err
	}
	if err := writeIniWithBackup(path, content); err != nil {
		return err
	}
	reloadFPM(version)
	return nil
}

// ---------------------------------------------------------------- shared FPM pool

// FpmPoolConfig is the shared www pool (/etc/php/<ver>/fpm/pool.d/www.conf) that serves the
// server's own sites. Account pools are generated from Main config + packages.
type FpmPoolConfig struct {
	Version                 string `json:"version"`
	Pm                      string `json:"pm"` // dynamic, static, ondemand
	MaxChildren             int    `json:"max_children"`
	StartServers            int    `json:"start_servers"`
	MinSpareServers         int    `json:"min_spare_servers"`
	MaxSpareServers         int    `json:"max_spare_servers"`
	ProcessIdleTimeout      int    `json:"process_idle_timeout"` // seconds
	MaxRequests             int    `json:"max_requests"`
	RequestTerminateTimeout int    `json:"request_terminate_timeout"` // seconds, 0 = off
	Listen                  string `json:"listen"`
	User                    string `json:"user"`
}

func wwwPoolPath(version string) string {
	return fmt.Sprintf("/etc/php/%s/fpm/pool.d/www.conf", version)
}

func poolInt(content, key string, def int) int {
	v := strings.TrimSuffix(activeIniValue(content, key), "s")
	if n, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
		return n
	}
	return def
}

func (p *PHPManagerService) GetFpmPoolConfig(version string) (*FpmPoolConfig, error) {
	if err := requireVersion(version); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(wwwPoolPath(version))
	if err != nil {
		return nil, fmt.Errorf("PHP %s has no www pool (is php%s-fpm installed?)", version, version)
	}
	c := string(data)
	pm := activeIniValue(c, "pm")
	if pm == "" {
		pm = "dynamic"
	}
	return &FpmPoolConfig{
		Version:                 version,
		Pm:                      pm,
		MaxChildren:             poolInt(c, "pm.max_children", 5),
		StartServers:            poolInt(c, "pm.start_servers", 2),
		MinSpareServers:         poolInt(c, "pm.min_spare_servers", 1),
		MaxSpareServers:         poolInt(c, "pm.max_spare_servers", 3),
		ProcessIdleTimeout:      poolInt(c, "pm.process_idle_timeout", 10),
		MaxRequests:             poolInt(c, "pm.max_requests", 0),
		RequestTerminateTimeout: poolInt(c, "request_terminate_timeout", 0),
		Listen:                  activeIniValue(c, "listen"),
		User:                    activeIniValue(c, "user"),
	}, nil
}

func validatePool(cfg *FpmPoolConfig) error {
	switch cfg.Pm {
	case "dynamic", "static", "ondemand":
	default:
		return fmt.Errorf("pm must be dynamic, static or ondemand")
	}
	if cfg.MaxChildren < 1 || cfg.MaxChildren > 1000 {
		return fmt.Errorf("max_children must be between 1 and 1000")
	}
	if cfg.Pm == "dynamic" {
		if cfg.MinSpareServers < 1 {
			return fmt.Errorf("min_spare_servers must be at least 1")
		}
		if cfg.MaxSpareServers < cfg.MinSpareServers {
			return fmt.Errorf("max_spare_servers must be ≥ min_spare_servers")
		}
		if cfg.MaxSpareServers > cfg.MaxChildren {
			return fmt.Errorf("max_spare_servers must be ≤ max_children")
		}
		if cfg.StartServers < cfg.MinSpareServers || cfg.StartServers > cfg.MaxSpareServers {
			return fmt.Errorf("start_servers must be between min_spare_servers and max_spare_servers")
		}
	}
	if cfg.Pm == "ondemand" && cfg.ProcessIdleTimeout < 1 {
		return fmt.Errorf("process_idle_timeout must be at least 1 second")
	}
	if cfg.MaxRequests < 0 || cfg.RequestTerminateTimeout < 0 {
		return fmt.Errorf("limits cannot be negative")
	}
	return nil
}

func (p *PHPManagerService) SaveFpmPoolConfig(cfg *FpmPoolConfig) error {
	if err := requireVersion(cfg.Version); err != nil {
		return err
	}
	if err := validatePool(cfg); err != nil {
		return err
	}
	path := wwwPoolPath(cfg.Version)
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	c := string(data)
	c = setIniDirective(c, "pm", cfg.Pm)
	c = setIniDirective(c, "pm.max_children", strconv.Itoa(cfg.MaxChildren))
	if cfg.Pm == "dynamic" {
		c = setIniDirective(c, "pm.start_servers", strconv.Itoa(cfg.StartServers))
		c = setIniDirective(c, "pm.min_spare_servers", strconv.Itoa(cfg.MinSpareServers))
		c = setIniDirective(c, "pm.max_spare_servers", strconv.Itoa(cfg.MaxSpareServers))
	}
	if cfg.Pm == "ondemand" {
		c = setIniDirective(c, "pm.process_idle_timeout", fmt.Sprintf("%ds", cfg.ProcessIdleTimeout))
	}
	c = setIniDirective(c, "pm.max_requests", strconv.Itoa(cfg.MaxRequests))
	c = setIniDirective(c, "request_terminate_timeout", fmt.Sprintf("%ds", cfg.RequestTerminateTimeout))

	if err := writeIniWithBackup(path, c); err != nil {
		return err
	}
	// Validate the whole FPM config before restarting; roll back on failure.
	if out, err := exec.Command(fmt.Sprintf("/usr/sbin/php-fpm%s", cfg.Version), "-t").CombinedOutput(); err != nil {
		_ = os.WriteFile(path, data, 0644)
		return fmt.Errorf("php-fpm rejected the pool, change reverted: %s", lastLines(string(out), 3))
	}
	if out, err := exec.Command("systemctl", "restart", fmt.Sprintf("php%s-fpm", cfg.Version)).CombinedOutput(); err != nil {
		return fmt.Errorf("pool saved but php%s-fpm failed to restart: %s", cfg.Version, lastLines(string(out), 3))
	}
	return nil
}

// AccountPool is a read-only summary of a per-account pool file.
type AccountPool struct {
	Name        string `json:"name"`
	PM          string `json:"pm"`
	MaxChildren int    `json:"max_children"`
	Memory      string `json:"memory_limit"`
}

// ListAccountPools lists the pool files other than www for a version.
func (p *PHPManagerService) ListAccountPools(version string) []AccountPool {
	if requireVersion(version) != nil {
		return nil
	}
	files, _ := filepath.Glob(fmt.Sprintf("/etc/php/%s/fpm/pool.d/*.conf", version))
	var out []AccountPool
	for _, f := range files {
		name := strings.TrimSuffix(filepath.Base(f), ".conf")
		if name == "www" {
			continue
		}
		b, err := os.ReadFile(f)
		if err != nil {
			continue
		}
		c := string(b)
		out = append(out, AccountPool{
			Name:        name,
			PM:          activeIniValue(c, "pm"),
			MaxChildren: poolInt(c, "pm.max_children", 0),
			Memory:      activeIniValue(c, "php_admin_value[memory_limit]"),
		})
	}
	return out
}

// ---------------------------------------------------------------- FPM service

// FPMServiceAction runs start | stop | restart | reload on php<ver>-fpm.
func (p *PHPManagerService) FPMServiceAction(version, action string) error {
	if !paths.PHPFPMInstalled(version) {
		return fmt.Errorf("PHP %s FPM is not installed", version)
	}
	switch action {
	case "start", "stop", "restart", "reload":
	default:
		return fmt.Errorf("invalid action %q", action)
	}
	if action == "stop" && version == paths.DefaultPHPVersion() {
		return fmt.Errorf("PHP %s is the server default; stopping it takes the default sites, webmail and phpMyAdmin down", version)
	}
	unit := fmt.Sprintf("php%s-fpm", version)
	if action == "start" {
		_ = exec.Command("systemctl", "enable", unit).Run()
	}
	if out, err := exec.Command("systemctl", action, unit).CombinedOutput(); err != nil {
		return fmt.Errorf("systemctl %s %s failed: %s", action, unit, lastLines(string(out), 3))
	}
	return nil
}

// ---------------------------------------------------------------- extensions

// SetExtensionState enables or disables an installed module with phpenmod/phpdismod.
func (p *PHPManagerService) SetExtensionState(version, ext string, enabled bool) error {
	if err := requireVersion(version); err != nil {
		return err
	}
	ext = strings.ToLower(strings.TrimSpace(ext))
	if !phpPkgNameRe.MatchString(ext) {
		return fmt.Errorf("invalid extension %q", ext)
	}
	if _, err := os.Stat(fmt.Sprintf("/etc/php/%s/mods-available/%s.ini", version, ext)); err != nil {
		if enabled {
			return fmt.Errorf("%s is not installed for PHP %s; install it first", ext, version)
		}
		return fmt.Errorf("%s is compiled into PHP %s and cannot be disabled", ext, version)
	}
	tool := "phpdismod"
	if enabled {
		tool = "phpenmod"
	}
	if out, err := exec.Command(tool, "-v", version, ext).CombinedOutput(); err != nil {
		return fmt.Errorf("%s failed: %s", tool, lastLines(string(out), 3))
	}
	reloadFPM(version)
	return nil
}

// ---------------------------------------------------------------- packages & removal

// PHPPackageOption is one optional package on the install page.
type PHPPackageOption struct {
	ID        string `json:"id"`
	Package   string `json:"package"`
	Available bool   `json:"available"`
}

var phpInstallChoices = []string{"cli", "fpm", "cgi", "common", "mysql", "curl", "mbstring", "xml", "zip", "gd", "intl", "bcmath", "sqlite3", "opcache", "soap", "redis", "imagick", "imap", "pgsql", "gmp", "memcached", "apcu", "xdebug"}

// PackageOptions reports which php<ver>-* packages apt can install right now.
func (p *PHPManagerService) PackageOptions(version string) ([]PHPPackageOption, error) {
	if err := requireVersion(version); err != nil {
		return nil, err
	}
	pkgs := make([]string, len(phpInstallChoices))
	for i, id := range phpInstallChoices {
		pkgs[i] = fmt.Sprintf("php%s-%s", version, id)
	}
	cands := aptCandidates(pkgs)
	out := make([]PHPPackageOption, len(pkgs))
	for i, id := range phpInstallChoices {
		out[i] = PHPPackageOption{ID: id, Package: pkgs[i], Available: cands[pkgs[i]]}
	}
	return out, nil
}

// PHPVersionUsage counts what still runs on a version.
type PHPVersionUsage struct {
	Websites []string `json:"websites"`
	Accounts []string `json:"accounts"`
}

func (p *PHPManagerService) VersionUsage(version string) PHPVersionUsage {
	var u PHPVersionUsage
	var rows []models.Website
	if err := panelOrm().Query().Where("status != ?", "deleted").Where("php_version = ?", version).Find(&rows); err == nil {
		for _, r := range rows {
			u.Websites = append(u.Websites, r.Domain)
		}
	}
	for _, acc := range NewUserAccountService().ListUsers() {
		if acc.PHPVersion == version {
			u.Accounts = append(u.Accounts, acc.Username)
		}
	}
	return u
}

// StartUninstall removes a PHP version as a live task, refusing while anything uses it.
func (p *PHPManagerService) StartUninstall(version string) (string, error) {
	if err := requireVersion(version); err != nil {
		return "", err
	}
	if !paths.PHPCLIInstalled(version) && !paths.PHPFPMInstalled(version) {
		return "", fmt.Errorf("PHP %s is not installed", version)
	}
	if version == paths.DefaultPHPVersion() {
		return "", fmt.Errorf("PHP %s is the server default; pick another default version first", version)
	}
	if len(paths.InstalledPHPVersions()) <= 1 {
		return "", fmt.Errorf("PHP %s is the only installed version", version)
	}
	if u := p.VersionUsage(version); len(u.Websites)+len(u.Accounts) > 0 {
		return "", fmt.Errorf("PHP %s is still used by %d website(s) and %d account(s); move them first", version, len(u.Websites), len(u.Accounts))
	}
	taskID := p.newTask(fmt.Sprintf("Remove PHP %s", version))
	go func() {
		p.appendLog(taskID, "⚙️ [2/4] Stopping php"+version+"-fpm")
		_ = exec.Command("systemctl", "disable", "--now", "php"+version+"-fpm").Run()
		p.setProgress(taskID, 30)
		p.appendLog(taskID, "📦 [3/4] Purging php"+version+"-* packages")
		if err := p.runStreaming(taskID, "bash", "-c", fmt.Sprintf("apt-get purge -y 'php%s-*' && apt-get autoremove -y", version)); err != nil {
			p.failTask(taskID, fmt.Sprintf("apt-get purge failed: %v", err))
			return
		}
		p.EnsureCLIDefault()
		p.appendLog(taskID, "✅ [4/4] PHP "+version+" removed.")
		p.setTaskStatus(taskID, "completed", 100)
	}()
	return taskID, nil
}
