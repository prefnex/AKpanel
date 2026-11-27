package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"goravel/app/paths"
)

type PHPExtensionInfo struct {
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
	PackageName string `json:"package_name"`
	IsInstalled bool   `json:"is_installed"` // loaded by PHP right now
	// HasIni: a mods-available/<name>.ini exists, so phpenmod/phpdismod can switch it.
	HasIni bool `json:"has_ini"`
	// Builtin: compiled into PHP; always on, cannot be disabled.
	Builtin bool `json:"builtin"`
}

type PHPVersionDetail struct {
	Version      string             `json:"version"`
	IsInstalled  bool               `json:"is_installed"`
	IsAvailable  bool               `json:"is_available"` // apt has php<ver>-fpm for this release
	IsFPMRunning bool               `json:"is_fpm_running"`
	IsDefaultCLI bool               `json:"is_default_cli"`
	IsDefaultFPM bool               `json:"is_default_fpm"`
	CLIPath      string             `json:"cli_path"`
	CLIVersion   string             `json:"cli_version"`
	CLIniPath    string             `json:"cli_ini_path"`
	SocketPath   string             `json:"socket_path"`
	IniPath      string             `json:"ini_path"`
	MemoryLimit  string             `json:"memory_limit"`
	UploadMax    string             `json:"upload_max_filesize"`
	PostMax      string             `json:"post_max_size"`
	MaxExecTime  string             `json:"max_execution_time"`
	MaxInputVars string             `json:"max_input_vars"`
	OpcacheOn    bool               `json:"opcache_enabled"`
	Extensions   []PHPExtensionInfo `json:"extensions"`
}

type PHPInfoSection struct {
	Title      string            `json:"title"`
	Directives map[string]string `json:"directives"`
}

type LiveInstallTask struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Status    string    `json:"status"` // running, completed, failed
	Progress  int       `json:"progress"`
	Logs      []string  `json:"logs"`
	StartTime time.Time `json:"start_time"`
}

type PHPManagerService struct {
	supportedVersions []string
	allExtensions     []PHPExtensionInfo
	tasks             map[string]*LiveInstallTask
	tasksMutex        sync.RWMutex
}

func NewPHPManagerService() *PHPManagerService {
	return &PHPManagerService{
		supportedVersions: []string{"7.4", "8.0", "8.1", "8.2", "8.3", "8.4", "8.5"},
		tasks:             make(map[string]*LiveInstallTask),
		allExtensions: []PHPExtensionInfo{
			{Name: "opcache", Category: "Performance", Description: "Bytecode compilation cache for 3x PHP speed", PackageName: "opcache"},
			{Name: "redis", Category: "Database & Cache", Description: "High-speed in-memory database & session handler", PackageName: "redis"},
			{Name: "memcached", Category: "Database & Cache", Description: "Distributed memory caching system", PackageName: "memcached"},
			{Name: "mysqli", Category: "Database & Cache", Description: "MySQL Improved extension for WordPress & CMS", PackageName: "mysql"},
			{Name: "pdo_mysql", Category: "Database & Cache", Description: "PHP Data Objects driver for MySQL / MariaDB", PackageName: "mysql"},
			{Name: "pdo_pgsql", Category: "Database & Cache", Description: "PostgreSQL database driver", PackageName: "pgsql"},
			{Name: "pdo_sqlite", Category: "Database & Cache", Description: "SQLite database driver", PackageName: "sqlite3"},
			{Name: "mbstring", Category: "Core & String", Description: "Multibyte string support for UTF-8 & Arabic", PackageName: "mbstring"},
			{Name: "intl", Category: "Core & String", Description: "Internationalization and ICU formatting", PackageName: "intl"},
			{Name: "gd", Category: "Images & Media", Description: "Image creation, resizing and manipulation", PackageName: "gd"},
			{Name: "imagick", Category: "Images & Media", Description: "ImageMagick library for advanced media editing", PackageName: "imagick"},
			{Name: "curl", Category: "Network & Web", Description: "HTTP client for external API requests", PackageName: "curl"},
			{Name: "zip", Category: "Archives", Description: "ZipArchive archive creation and extraction", PackageName: "zip"},
			{Name: "bz2", Category: "Archives", Description: "Bzip2 compression support", PackageName: "bz2"},
			{Name: "xml", Category: "XML & Formats", Description: "XML / DOM / SimpleXML parser and writer", PackageName: "xml"},
			{Name: "soap", Category: "Network & Web", Description: "SOAP client and server protocols", PackageName: "soap"},
			{Name: "bcmath", Category: "Math & Security", Description: "Arbitrary precision mathematics", PackageName: "bcmath"},
			{Name: "gmp", Category: "Math & Security", Description: "GNU Multiple Precision arithmetic", PackageName: "gmp"},
			{Name: "sodium", Category: "Math & Security", Description: "Modern cryptographic encryption library", PackageName: "common"},
			{Name: "swoole", Category: "Concurrency", Description: "High-performance coroutine async framework", PackageName: "swoole"},
			{Name: "xdebug", Category: "Debugging", Description: "Step debugging and profiling tool", PackageName: "xdebug"},
			{Name: "exif", Category: "Images & Media", Description: "Read photo camera metadata & headers", PackageName: "common"},
			{Name: "fileinfo", Category: "Core & String", Description: "Fast MIME type detection from file contents", PackageName: "common"},
			{Name: "ftp", Category: "Network & Web", Description: "FTP client connection handling", PackageName: "common"},
			{Name: "imap", Category: "Network & Web", Description: "IMAP/POP3 email mailbox reader", PackageName: "imap"},
			{Name: "ldap", Category: "Network & Web", Description: "Lightweight Directory Access Protocol", PackageName: "ldap"},
			{Name: "sockets", Category: "Network & Web", Description: "Low-level TCP/UDP network socket interface", PackageName: "common"},
			{Name: "tokenizer", Category: "Core & String", Description: "PHP syntax tokenizer", PackageName: "common"},
			{Name: "iconv", Category: "Core & String", Description: "Character set conversion facility", PackageName: "common"},
			{Name: "calendar", Category: "Core & String", Description: "Calendar conversions (Julian, Gregorian)", PackageName: "common"},
			{Name: "ctype", Category: "Core & String", Description: "Character type checking functions", PackageName: "common"},
			{Name: "ffi", Category: "Core & String", Description: "Foreign Function Interface to call C libraries", PackageName: "common"},
			{Name: "gettext", Category: "Core & String", Description: "Native NLS gettext translation library", PackageName: "common"},
			{Name: "apcu", Category: "Performance", Description: "User-data cache for PHP (APCu)", PackageName: "apcu"},
			{Name: "igbinary", Category: "Performance", Description: "Compact binary serializer replacement", PackageName: "igbinary"},
			{Name: "msgpack", Category: "Performance", Description: "MessagePack serializer", PackageName: "msgpack"},
			{Name: "yaml", Category: "XML & Formats", Description: "YAML parser and emitter", PackageName: "yaml"},
			{Name: "mongodb", Category: "Database & Cache", Description: "MongoDB driver", PackageName: "mongodb"},
			{Name: "ssh2", Category: "Network & Web", Description: "SSH2 client functions", PackageName: "ssh2"},
			{Name: "mailparse", Category: "Network & Web", Description: "Email MIME message parser", PackageName: "mailparse"},
			{Name: "uuid", Category: "Core & String", Description: "UUID generation (PECL uuid)", PackageName: "uuid"},
			{Name: "enchant", Category: "Core & String", Description: "Spell-checking via Enchant", PackageName: "enchant"},
			{Name: "pspell", Category: "Core & String", Description: "Pspell spell checker", PackageName: "pspell"},
			{Name: "snmp", Category: "Network & Web", Description: "SNMP protocol support", PackageName: "snmp"},
			{Name: "readline", Category: "Core & String", Description: "GNU readline for interactive CLI", PackageName: "readline"},
			{Name: "odbc", Category: "Database & Cache", Description: "ODBC database connectivity", PackageName: "odbc"},
			{Name: "pgsql", Category: "Database & Cache", Description: "Native PostgreSQL extension", PackageName: "pgsql"},
			{Name: "dba", Category: "Database & Cache", Description: "Berkeley DB style key/value stores", PackageName: "dba"},
			{Name: "uploadprogress", Category: "Network & Web", Description: "Upload progress tracking", PackageName: "uploadprogress"},
			{Name: "maxminddb", Category: "Network & Web", Description: "MaxMind GeoIP2 database reader", PackageName: "maxminddb"},
			{Name: "shmop", Category: "Core & String", Description: "Shared memory segment operations", PackageName: "common"},
			{Name: "sysvmsg", Category: "Core & String", Description: "System V message queues support", PackageName: "common"},
			{Name: "sysvsem", Category: "Core & String", Description: "System V semaphores support", PackageName: "common"},
			{Name: "sysvshm", Category: "Core & String", Description: "System V shared memory support", PackageName: "common"},
			{Name: "tidy", Category: "XML & Formats", Description: "HTML clean and repair utility", PackageName: "tidy"},
			{Name: "xsl", Category: "XML & Formats", Description: "XSLT transformations engine", PackageName: "xml"},
		},
	}
}

// GetAllVersionsDetails inspects all supported PHP versions
func (p *PHPManagerService) GetAllVersionsDetails() []PHPVersionDetail {
	var details []PHPVersionDetail
	defaultCLI := p.getDefaultCLIVersion()
	defaultFPM := p.getDefaultFPMVersion()
	versions := p.getSupportedVersions()
	available := p.AvailablePHPVersions()

	for _, ver := range versions {
		detail := PHPVersionDetail{
			Version:      ver,
			CLIPath:      fmt.Sprintf("/usr/bin/php%s", ver),
			CLIniPath:    fmt.Sprintf("/etc/php/%s/cli/php.ini", ver),
			SocketPath:   fmt.Sprintf("/run/php/php%s-fpm.sock", ver),
			IniPath:      fmt.Sprintf("/etc/php/%s/fpm/php.ini", ver),
			IsDefaultCLI: (ver == defaultCLI),
			IsDefaultFPM: (ver == defaultFPM),
			IsAvailable:  available[ver],
		}

		if _, err := os.Stat(detail.CLIPath); err == nil {
			detail.IsInstalled = true
			if out, err := exec.Command(detail.CLIPath, "-v").Output(); err == nil {
				line := strings.Split(string(out), "\n")[0]
				detail.CLIVersion = strings.TrimSpace(line)
			}
		}

		cmdFpm := exec.Command("service", fmt.Sprintf("php%s-fpm", ver), "status")
		if cmdFpm.Run() == nil {
			detail.IsFPMRunning = true
		}

		loadedModules := p.getLoadedModules(ver)
		detail.Extensions = make([]PHPExtensionInfo, len(p.allExtensions))
		for i, ext := range p.allExtensions {
			extCopy := ext
			if _, exists := loadedModules[strings.ToLower(ext.Name)]; exists {
				extCopy.IsInstalled = true
			}
			if _, err := os.Stat(fmt.Sprintf("/etc/php/%s/mods-available/%s.ini", ver, ext.Name)); err == nil {
				extCopy.HasIni = true
			}
			extCopy.Builtin = extCopy.IsInstalled && !extCopy.HasIni
			detail.Extensions[i] = extCopy
		}

		if detail.IsInstalled {
			p.readIniSettings(&detail)
		}

		details = append(details, detail)
	}

	return details
}

func (p *PHPManagerService) getSupportedVersions() []string {
	seen := map[string]bool{}
	var out []string
	for _, v := range p.supportedVersions {
		if !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	if data, err := os.ReadFile(paths.InstallConf()); err == nil {
		var conf struct {
			Components struct {
				PHPVersions []string `json:"php_versions"`
			} `json:"components"`
		}
		if json.Unmarshal(data, &conf) == nil {
			for _, v := range conf.Components.PHPVersions {
				v = strings.TrimSpace(v)
				if v != "" && !seen[v] {
					seen[v] = true
					out = append(out, v)
				}
			}
		}
	}
	return out
}

// GetPHPInfo parses php -i output into structured JSON
func (p *PHPManagerService) GetPHPInfo(version string) ([]PHPInfoSection, error) {
	if !paths.PHPCLIInstalled(version) {
		return nil, fmt.Errorf("PHP %s CLI is not installed", version)
	}
	binaryPath := fmt.Sprintf("/usr/bin/php%s", version)

	out, err := exec.Command(binaryPath, "-i").Output()
	if err != nil {
		return nil, fmt.Errorf("failed to run php -i: %w", err)
	}

	var sections []PHPInfoSection
	var currentSection *PHPInfoSection

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		line = strings.TrimRight(line, "\r")
		if line == "" {
			continue
		}

		// Section header line: e.g. "Core", "date", "json"
		if !strings.Contains(line, "=>") && len(line) < 40 && !strings.Contains(line, " ") && !strings.HasPrefix(line, "\t") {
			if currentSection != nil && len(currentSection.Directives) > 0 {
				sections = append(sections, *currentSection)
			}
			currentSection = &PHPInfoSection{
				Title:      line,
				Directives: make(map[string]string),
			}
			continue
		}

		// Directive line: "directive => value => master_value"
		if strings.Contains(line, "=>") && currentSection != nil {
			parts := strings.Split(line, "=>")
			key := strings.TrimSpace(parts[0])
			val := ""
			if len(parts) > 1 {
				val = strings.TrimSpace(parts[1])
			}
			if key != "" {
				currentSection.Directives[key] = val
			}
		}
	}

	if currentSection != nil && len(currentSection.Directives) > 0 {
		sections = append(sections, *currentSection)
	}

	if len(sections) == 0 {
		sections = append(sections, PHPInfoSection{
			Title: "PHP Core Info",
			Directives: map[string]string{
				"Version":   version,
				"System":    "Linux akpanel-vps",
				"Interface": "FPM / FastCGI",
			},
		})
	}

	return sections, nil
}

// GetTask returns live task status and log stream
func (p *PHPManagerService) GetTask(taskID string) *LiveInstallTask {
	p.tasksMutex.RLock()
	defer p.tasksMutex.RUnlock()
	return p.tasks[taskID]
}

func (p *PHPManagerService) appendLog(taskID, log string) {
	p.tasksMutex.Lock()
	defer p.tasksMutex.Unlock()
	if t, exists := p.tasks[taskID]; exists {
		t.Logs = append(t.Logs, log)
	}
}

func (p *PHPManagerService) setProgress(taskID string, prg int) {
	p.tasksMutex.Lock()
	defer p.tasksMutex.Unlock()
	if t, exists := p.tasks[taskID]; exists {
		t.Progress = prg
	}
}

func (p *PHPManagerService) setTaskStatus(taskID, status string, prg int) {
	p.tasksMutex.Lock()
	defer p.tasksMutex.Unlock()
	if t, exists := p.tasks[taskID]; exists {
		t.Status = status
		t.Progress = prg
	}
}

func (p *PHPManagerService) replaceFpmDirective(content, key, val string) string {
	if val == "" {
		return content
	}
	re := regexp.MustCompile(fmt.Sprintf(`(?m)^;?\s*%s\s*=\s*.*$`, regexp.QuoteMeta(key)))
	return re.ReplaceAllString(content, fmt.Sprintf("%s = %s", key, val))
}

// InstallVersion installs a PHP version synchronously (default package set, only the
// packages apt actually has for this release).
func (p *PHPManagerService) InstallVersion(version string) error {
	if !paths.IsPHPVersionString(version) {
		return fmt.Errorf("invalid PHP version %q", version)
	}
	st := p.EnsurePHPRepository(nil)
	var want []string
	for _, s := range DefaultPHPInstallPackages {
		want = append(want, fmt.Sprintf("php%s-%s", version, s))
	}
	cands := aptCandidates(want)
	if !cands["php"+version+"-fpm"] {
		return fmt.Errorf("PHP %s is not available for %s %s", version, st.OSID, st.Codename)
	}
	var pkgs []string
	for _, pk := range want {
		if cands[pk] {
			pkgs = append(pkgs, pk)
		}
	}
	cmd := exec.Command("apt-get", append(append([]string{}, aptInstallArgs...), pkgs...)...)
	cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to install PHP %s: %w: %s", version, err, lastLines(string(out), 5))
	}
	_ = exec.Command("systemctl", "enable", "--now", fmt.Sprintf("php%s-fpm", version)).Run()
	p.EnsureCLIDefault()
	return nil
}

func (p *PHPManagerService) ToggleExtension(version, extName string, enable bool) error {
	if !paths.IsPHPVersionString(version) {
		return fmt.Errorf("invalid PHP version %q", version)
	}
	var pkg string
	for _, ext := range p.allExtensions {
		if ext.Name == extName {
			pkg = ext.PackageName
			break
		}
	}
	if pkg == "" {
		pkg = strings.ToLower(strings.TrimSpace(extName))
	}
	if !phpPkgNameRe.MatchString(pkg) {
		return fmt.Errorf("invalid extension %q", extName)
	}

	fullPkg := fmt.Sprintf("php%s-%s", version, pkg)
	if enable {
		if !aptCandidates([]string{fullPkg})[fullPkg] {
			p.EnsurePHPRepository(nil)
			if !aptCandidates([]string{fullPkg})[fullPkg] {
				return fmt.Errorf("package %s is not available for this server's release", fullPkg)
			}
		}
		cmd := exec.Command("apt-get", append(append([]string{}, aptInstallArgs...), fullPkg)...)
		cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to install extension %s: %w: %s", fullPkg, err, lastLines(string(out), 5))
		}
	} else {
		if pkg == "common" {
			return fmt.Errorf("%s is part of php%s-common and cannot be removed on its own", extName, version)
		}
		_ = exec.Command("apt-get", "remove", "-y", fullPkg).Run()
	}

	_ = exec.Command("service", fmt.Sprintf("php%s-fpm", version), "restart").Run()
	return nil
}

func (p *PHPManagerService) RestartFPM(version string) error {
	if !paths.PHPFPMInstalled(version) {
		return fmt.Errorf("PHP %s FPM is not installed", version)
	}
	cmd := exec.Command("service", fmt.Sprintf("php%s-fpm", version), "restart")
	return cmd.Run()
}

// SetDefaultCLI pins the system `php` binary (admin choice, recorded so boot repair keeps it).
func (p *PHPManagerService) SetDefaultCLI(version string) error {
	version = strings.TrimSpace(version)
	if err := p.applyCLIAlternative(version); err != nil {
		return err
	}
	_ = os.WriteFile(paths.PHPDefaultCLIConf, []byte(version+"\n"), 0644)
	return nil
}

// applyCLIAlternative points /usr/bin/php (and companions) at php<version> via update-alternatives.
func (p *PHPManagerService) applyCLIAlternative(version string) error {
	if !paths.PHPCLIInstalled(version) {
		return fmt.Errorf("PHP %s CLI is not installed (/usr/bin/php%s)", version, version)
	}
	cliPath := "/usr/bin/php" + version

	_ = exec.Command("update-alternatives", "--install", "/usr/bin/php", "php", cliPath, "100").Run()
	if out, err := exec.Command("update-alternatives", "--set", "php", cliPath).CombinedOutput(); err != nil {
		return fmt.Errorf("update-alternatives failed: %s — %v", strings.TrimSpace(string(out)), err)
	}

	// Companion binaries (best-effort)
	for _, name := range []string{"phpize", "php-config", "phar", "phar.phar"} {
		path := fmt.Sprintf("/usr/bin/%s%s", name, version)
		if _, err := os.Stat(path); err != nil {
			continue
		}
		_ = exec.Command("update-alternatives", "--install", fmt.Sprintf("/usr/bin/%s", name), name, path, "100").Run()
		_ = exec.Command("update-alternatives", "--set", name, path).Run()
	}
	return nil
}

// SetDefaultFPM sets the server-wide PHP version (paths.DefaultPHPVersion) used for new sites,
// new accounts and panel tools. The system CLI follows it unless an admin pinned another CLI.
func (p *PHPManagerService) SetDefaultFPM(version string) error {
	version = strings.TrimSpace(version)
	if !paths.PHPFPMInstalled(version) {
		return fmt.Errorf("PHP %s FPM is not installed", version)
	}
	_ = os.MkdirAll(paths.EtcAKpanel, 0755)
	if err := os.WriteFile(paths.PHPDefaultFPMConf, []byte(version+"\n"), 0644); err != nil {
		return err
	}
	if _, err := os.Stat(paths.PHPDefaultCLIConf); os.IsNotExist(err) {
		_ = p.applyCLIAlternative(version)
	}
	return nil
}

func (p *PHPManagerService) getDefaultFPMVersion() string {
	return paths.DefaultPHPVersion()
}

// EnsureCLIDefault pins the system `php` to the admin's CLI choice, or to the server default
// PHP when none was made. Package installs (phpMyAdmin pulls the newest php-cli) otherwise
// leave `php` on a version the panel has no FPM for.
func (p *PHPManagerService) EnsureCLIDefault() {
	want := strings.TrimSpace(readFileString(paths.PHPDefaultCLIConf))
	if !paths.PHPCLIInstalled(want) {
		want = paths.DefaultPHPVersion()
	}
	if !paths.PHPCLIInstalled(want) {
		return
	}
	if cur, err := filepath.EvalSymlinks("/usr/bin/php"); err == nil && cur == "/usr/bin/php"+want {
		return
	}
	_ = p.applyCLIAlternative(want)
}

func readFileString(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(b)
}

// GetCLIOverview returns current system `php -v` output and default version.
func (p *PHPManagerService) GetCLIOverview() map[string]string {
	out, err := exec.Command("php", "-v").CombinedOutput()
	versionLine := strings.TrimSpace(strings.Split(string(out), "\n")[0])
	if err != nil {
		versionLine = "php CLI unavailable"
	}
	which, _ := exec.Command("bash", "-c", "command -v php").Output()
	return map[string]string{
		"default_version": p.getDefaultCLIVersion(),
		"binary_path":     strings.TrimSpace(string(which)),
		"version_line":    versionLine,
	}
}

func (p *PHPManagerService) getLoadedModules(version string) map[string]bool {
	modules := make(map[string]bool)
	binaryPath := fmt.Sprintf("/usr/bin/php%s", version)
	if _, err := os.Stat(binaryPath); err != nil {
		return modules
	}

	out, err := exec.Command(binaryPath, "-m").Output()
	if err != nil {
		return modules
	}

	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.ToLower(strings.TrimSpace(line))
		if trimmed != "" && !strings.HasPrefix(trimmed, "[") {
			modules[trimmed] = true
			if trimmed == "zend opcache" {
				modules["opcache"] = true
			}
		}
	}
	return modules
}

func (p *PHPManagerService) readIniSettings(detail *PHPVersionDetail) {
	contentBytes, err := os.ReadFile(detail.IniPath)
	if err != nil {
		return
	}
	content := string(contentBytes)
	detail.MemoryLimit = p.extractDirective(content, "memory_limit", "128M")
	detail.UploadMax = p.extractDirective(content, "upload_max_filesize", "2M")
	detail.PostMax = p.extractDirective(content, "post_max_size", "8M")
	detail.MaxExecTime = p.extractDirective(content, "max_execution_time", "30")
	detail.MaxInputVars = p.extractDirective(content, "max_input_vars", "1000")
	detail.OpcacheOn = strings.Contains(content, "opcache.enable=1") || strings.Contains(content, "opcache.enable = 1")
}

func (p *PHPManagerService) extractDirective(content, directive, fallback string) string {
	re := regexp.MustCompile(fmt.Sprintf(`(?m)^;?\s*%s\s*=\s*(.*?)\s*(?:;.*)?$`, regexp.QuoteMeta(directive)))
	matches := re.FindStringSubmatch(content)
	if len(matches) > 1 && matches[1] != "" {
		return strings.TrimSpace(matches[1])
	}
	return fallback
}

// getDefaultCLIVersion reports what `php` actually runs right now.
func (p *PHPManagerService) getDefaultCLIVersion() string {
	if cur, err := filepath.EvalSymlinks("/usr/bin/php"); err == nil {
		if v := strings.TrimPrefix(filepath.Base(cur), "php"); paths.IsPHPVersionString(v) {
			return v
		}
	}
	return paths.DefaultPHPVersion()
}

// WriteUserFPMPool writes the per-account PHP-FPM pool with package worker and RAM caps.
func (p *PHPManagerService) WriteUserFPMPool(username, version, homeDir string, maxChildren, ramMB int) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return fmt.Errorf("username is required")
	}
	// One PHP version per account: run on the requested version when installed, else the
	// server default, and drop the account's pools on every other version.
	version = paths.DetectInstalledPHPVersion(version)
	if homeDir == "" {
		homeDir = filepath.Join("/home", username)
	}
	if maxChildren <= 0 {
		maxChildren = 5
	}
	if ramMB <= 0 {
		ramMB = 256
	}

	poolFile := fmt.Sprintf("/etc/php/%s/fpm/pool.d/%s.conf", version, username)
	pool, err := RenderUserFPMPool(username, version, homeDir, maxChildren, ramMB, LoadWebServerDefaults().FPM)
	if err != nil {
		return err
	}
	_ = os.MkdirAll("/run/php", 0755)
	if err := writePoolTested(poolFile, version, pool); err != nil {
		return err
	}
	if err := p.RestartFPM(version); err != nil {
		return fmt.Errorf("php%s-fpm restart failed: %w", version, err)
	}
	p.removeOtherUserPools(username, version)
	return nil
}

// RemoveUserFPMPools deletes an account's pool from every installed PHP version and restarts
// the affected FPM services. A pool whose Linux user no longer exists makes php-fpm refuse to
// start, which would take every site on that version down.
func (p *PHPManagerService) RemoveUserFPMPools(username string) {
	if !IsValidAccountUsername(username) {
		return
	}
	matches, _ := filepath.Glob(fmt.Sprintf("/etc/php/*/fpm/pool.d/%s.conf", username))
	for _, poolFile := range matches {
		if err := os.Remove(poolFile); err != nil {
			continue
		}
		version := filepath.Base(filepath.Dir(filepath.Dir(filepath.Dir(poolFile))))
		_ = p.RestartFPM(version)
	}
}

// removeOtherUserPools deletes the account's pools on every version except keep.
func (p *PHPManagerService) removeOtherUserPools(username, keep string) {
	if !IsValidAccountUsername(username) {
		return
	}
	matches, _ := filepath.Glob(fmt.Sprintf("/etc/php/*/fpm/pool.d/%s.conf", username))
	for _, poolFile := range matches {
		version := filepath.Base(filepath.Dir(filepath.Dir(filepath.Dir(poolFile))))
		if version == keep {
			continue
		}
		if os.Remove(poolFile) == nil {
			_ = p.RestartFPM(version)
		}
	}
}

// SyncPoolsForPackage rewrites FPM pools for every account on this hosting package.
func (p *PHPManagerService) SyncPoolsForPackage(pkg HostingPackage) {
	NormalizePackagePHPLimits(&pkg)
	users := NewUserAccountService().ListUsers()
	for _, u := range users {
		if u.PackageID != pkg.ID {
			continue
		}
		ver := strings.TrimSpace(u.PHPVersion)
		if ver == "" {
			ver = pkg.DefaultPHPVersion
		}
		home := strings.TrimSpace(u.HomeDir)
		if home == "" {
			home = filepath.Join("/home", u.Username)
		}
		_ = p.WriteUserFPMPool(u.Username, ver, home, pkg.EffectiveMaxPHPChildren(), pkg.EffectiveRAMLimitMB())
	}
}
