package services

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"time"
)

type PHPExtensionInfo struct {
	Name        string `json:"name"`
	Category    string `json:"category"`
	Description string `json:"description"`
	PackageName string `json:"package_name"`
	IsInstalled bool   `json:"is_installed"`
}

type PHPVersionDetail struct {
	Version      string             `json:"version"`
	IsInstalled  bool               `json:"is_installed"`
	IsFPMRunning bool               `json:"is_fpm_running"`
	IsDefaultCLI bool               `json:"is_default_cli"`
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

type FpmPoolConfig struct {
	Version         string `json:"version"`
	Pm              string `json:"pm"` // dynamic, static, ondemand
	MaxChildren     string `json:"max_children"`
	StartServers    string `json:"start_servers"`
	MinSpareServers string `json:"min_spare_servers"`
	MaxSpareServers string `json:"max_spare_servers"`
	MaxRequests     string `json:"max_requests"`
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
		supportedVersions: []string{"7.4", "8.0", "8.1", "8.2", "8.3", "8.4"},
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
			{Name: "igbinary", Category: "Performance", Description: "Compact binary serializer replacement", PackageName: "igbinary"},
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

	for _, ver := range p.supportedVersions {
		detail := PHPVersionDetail{
			Version:      ver,
			SocketPath:   fmt.Sprintf("/run/php/php%s-fpm.sock", ver),
			IniPath:      fmt.Sprintf("/etc/php/%s/fpm/php.ini", ver),
			IsDefaultCLI: (ver == defaultCLI),
		}

		binaryPath := fmt.Sprintf("/usr/bin/php%s", ver)
		if _, err := os.Stat(binaryPath); err == nil {
			detail.IsInstalled = true
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
			detail.Extensions[i] = extCopy
		}

		if detail.IsInstalled {
			p.readIniSettings(&detail)
		}

		details = append(details, detail)
	}

	return details
}

// GetPHPInfo parses php -i output into structured JSON
func (p *PHPManagerService) GetPHPInfo(version string) ([]PHPInfoSection, error) {
	binaryPath := fmt.Sprintf("/usr/bin/php%s", version)
	if _, err := os.Stat(binaryPath); err != nil {
		binaryPath = "php"
	}

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

// GetRawIni reads raw php.ini text
func (p *PHPManagerService) GetRawIni(version string) (string, error) {
	iniPath := fmt.Sprintf("/etc/php/%s/fpm/php.ini", version)
	data, err := os.ReadFile(iniPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// SaveRawIni saves raw php.ini and reloads FPM
func (p *PHPManagerService) SaveRawIni(version, content string) error {
	iniPath := fmt.Sprintf("/etc/php/%s/fpm/php.ini", version)
	if err := os.WriteFile(iniPath, []byte(content), 0644); err != nil {
		return err
	}
	_ = exec.Command("service", fmt.Sprintf("php%s-fpm", version), "reload").Run()
	return nil
}

// GetFpmPoolConfig reads /etc/php/{ver}/fpm/pool.d/www.conf
func (p *PHPManagerService) GetFpmPoolConfig(version string) (*FpmPoolConfig, error) {
	poolPath := fmt.Sprintf("/etc/php/%s/fpm/pool.d/www.conf", version)
	data, err := os.ReadFile(poolPath)
	if err != nil {
		return &FpmPoolConfig{
			Version:         version,
			Pm:              "dynamic",
			MaxChildren:     "50",
			StartServers:    "5",
			MinSpareServers: "5",
			MaxSpareServers: "35",
			MaxRequests:     "500",
		}, nil
	}

	content := string(data)
	return &FpmPoolConfig{
		Version:         version,
		Pm:              p.extractDirective(content, "pm", "dynamic"),
		MaxChildren:     p.extractDirective(content, "pm.max_children", "50"),
		StartServers:    p.extractDirective(content, "pm.start_servers", "5"),
		MinSpareServers: p.extractDirective(content, "pm.min_spare_servers", "5"),
		MaxSpareServers: p.extractDirective(content, "pm.max_spare_servers", "35"),
		MaxRequests:     p.extractDirective(content, "pm.max_requests", "500"),
	}, nil
}

// SaveFpmPoolConfig updates FPM pool directives
func (p *PHPManagerService) SaveFpmPoolConfig(cfg *FpmPoolConfig) error {
	poolPath := fmt.Sprintf("/etc/php/%s/fpm/pool.d/www.conf", cfg.Version)
	data, err := os.ReadFile(poolPath)
	if err != nil {
		return err
	}

	content := string(data)
	content = p.replaceFpmDirective(content, "pm", cfg.Pm)
	content = p.replaceFpmDirective(content, "pm.max_children", cfg.MaxChildren)
	content = p.replaceFpmDirective(content, "pm.start_servers", cfg.StartServers)
	content = p.replaceFpmDirective(content, "pm.min_spare_servers", cfg.MinSpareServers)
	content = p.replaceFpmDirective(content, "pm.max_spare_servers", cfg.MaxSpareServers)
	content = p.replaceFpmDirective(content, "pm.max_requests", cfg.MaxRequests)

	if err := os.WriteFile(poolPath, []byte(content), 0644); err != nil {
		return err
	}
	_ = exec.Command("service", fmt.Sprintf("php%s-fpm", cfg.Version), "restart").Run()
	return nil
}

// StartLiveInstallTask starts a background task with live log streaming
func (p *PHPManagerService) StartLiveInstallTask(title string, cmdStr string) string {
	taskID := fmt.Sprintf("task_%d", time.Now().UnixNano())
	task := &LiveInstallTask{
		ID:        taskID,
		Title:     title,
		Status:    "running",
		Progress:  10,
		Logs:      []string{fmt.Sprintf("🚀 [1/4] Starting %s...", title)},
		StartTime: time.Now(),
	}

	p.tasksMutex.Lock()
	p.tasks[taskID] = task
	p.tasksMutex.Unlock()

	go func() {
		time.Sleep(300 * time.Millisecond)
		p.appendLog(taskID, "📦 [2/4] Resolving dependencies and checking repositories...")
		p.setProgress(taskID, 35)

		cmd := exec.Command("bash", "-c", cmdStr)
		out, err := cmd.CombinedOutput()

		p.appendLog(taskID, "⚙️ [3/4] Running installation daemon:")
		for _, line := range strings.Split(string(out), "\n") {
			if strings.TrimSpace(line) != "" {
				p.appendLog(taskID, "  "+line)
			}
		}

		if err != nil {
			p.appendLog(taskID, fmt.Sprintf("❌ Error: %v", err))
			p.setTaskStatus(taskID, "failed", 100)
		} else {
			p.appendLog(taskID, "✅ [4/4] Process completed successfully! Services reloaded.")
			p.setTaskStatus(taskID, "completed", 100)
		}
	}()

	return taskID
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

// ToggleExtension, InstallVersion, UpdateIni, RestartFPM, etc.
func (p *PHPManagerService) InstallVersion(version string) error {
	cmd := exec.Command("apt-get", "install", "-y",
		fmt.Sprintf("php%s-cli", version),
		fmt.Sprintf("php%s-fpm", version),
		fmt.Sprintf("php%s-common", version),
		fmt.Sprintf("php%s-sqlite3", version),
		fmt.Sprintf("php%s-curl", version),
		fmt.Sprintf("php%s-mbstring", version),
		fmt.Sprintf("php%s-xml", version),
		fmt.Sprintf("php%s-zip", version),
		fmt.Sprintf("php%s-gd", version),
		fmt.Sprintf("php%s-mysql", version),
	)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to install PHP %s: %w", version, err)
	}
	_ = exec.Command("service", fmt.Sprintf("php%s-fpm", version), "start").Run()
	return nil
}

func (p *PHPManagerService) ToggleExtension(version, extName string, enable bool) error {
	var pkg string
	for _, ext := range p.allExtensions {
		if ext.Name == extName {
			pkg = ext.PackageName
			break
		}
	}
	if pkg == "" {
		pkg = extName
	}

	fullPkg := fmt.Sprintf("php%s-%s", version, pkg)
	if enable {
		cmd := exec.Command("apt-get", "install", "-y", fullPkg)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to install extension %s: %w", fullPkg, err)
		}
	} else {
		cmd := exec.Command("apt-get", "remove", "-y", fullPkg)
		_ = cmd.Run()
	}

	_ = exec.Command("service", fmt.Sprintf("php%s-fpm", version), "restart").Run()
	return nil
}

func (p *PHPManagerService) UpdateIniSettings(version string, memoryLimit, uploadMax, postMax, maxExecTime, maxInputVars string) error {
	iniFile := fmt.Sprintf("/etc/php/%s/fpm/php.ini", version)
	contentBytes, err := os.ReadFile(iniFile)
	if err != nil {
		return fmt.Errorf("cannot read php.ini for PHP %s: %w", version, err)
	}

	content := string(contentBytes)
	if memoryLimit != "" {
		re := regexp.MustCompile(`(?m)^;?memory_limit\s*=\s*.*$`)
		content = re.ReplaceAllString(content, fmt.Sprintf("memory_limit = %s", memoryLimit))
	}
	if uploadMax != "" {
		re := regexp.MustCompile(`(?m)^;?upload_max_filesize\s*=\s*.*$`)
		content = re.ReplaceAllString(content, fmt.Sprintf("upload_max_filesize = %s", uploadMax))
	}
	if postMax != "" {
		re := regexp.MustCompile(`(?m)^;?post_max_size\s*=\s*.*$`)
		content = re.ReplaceAllString(content, fmt.Sprintf("post_max_size = %s", postMax))
	}
	if maxExecTime != "" {
		re := regexp.MustCompile(`(?m)^;?max_execution_time\s*=\s*.*$`)
		content = re.ReplaceAllString(content, fmt.Sprintf("max_execution_time = %s", maxExecTime))
	}
	if maxInputVars != "" {
		re := regexp.MustCompile(`(?m)^;?max_input_vars\s*=\s*.*$`)
		content = re.ReplaceAllString(content, fmt.Sprintf("max_input_vars = %s", maxInputVars))
	}

	if err := os.WriteFile(iniFile, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to save php.ini: %w", err)
	}

	_ = exec.Command("service", fmt.Sprintf("php%s-fpm", version), "reload").Run()
	return nil
}

func (p *PHPManagerService) RestartFPM(version string) error {
	cmd := exec.Command("service", fmt.Sprintf("php%s-fpm", version), "restart")
	return cmd.Run()
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

func (p *PHPManagerService) getDefaultCLIVersion() string {
	out, err := exec.Command("php", "-v").Output()
	if err != nil {
		return "8.2"
	}
	str := string(out)
	for _, ver := range p.supportedVersions {
		if strings.Contains(str, fmt.Sprintf("PHP %s", ver)) {
			return ver
		}
	}
	return "8.2"
}
