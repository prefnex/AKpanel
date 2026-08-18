package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

type UserAccount struct {
	Username          string `json:"username"`
	Password          string `json:"password,omitempty"`
	PasswordHash      string `json:"password_hash,omitempty"`
	Email             string `json:"email"`
	MainDomain        string `json:"main_domain"`
	IPAddress         string `json:"ip_address"`
	SetupTime         string `json:"setup_time"`
	PackageID         string `json:"package_id"`
	PackageName       string `json:"package_name"`
	IsReseller        bool   `json:"is_reseller"`
	Language          string `json:"language"`
	HomeDir           string `json:"home_dir"`
	Status            string `json:"status"` // active, suspended
	DiskUsedMB        int    `json:"disk_used_mb"`
	DiskQuotaMB       int    `json:"disk_quota_mb"`
	BandwidthUsedMB   int    `json:"bandwidth_used_mb"`
	BandwidthLimitMB  int    `json:"bandwidth_limit_mb"`
	InodesUsed        int    `json:"inodes_used"`
	InodesLimit       int    `json:"inodes_limit"`
	RAMLimitMB        int    `json:"ram_limit_mb"`
	ActiveProcesses   int    `json:"active_processes"`
	MaxProcesses      int    `json:"max_processes"`
	OpenFilesLimit    int    `json:"open_files_limit"` // nofile
	AutoSSL           bool   `json:"autossl"`
	BackupEnabled     bool   `json:"backup_enabled"`
	DomainsCount      int    `json:"domains_count"`
	MaxDomains        int    `json:"max_domains"`
	DatabasesCount    int    `json:"databases_count"`
	MaxDatabases      int    `json:"max_databases"`
	FTPCount          int    `json:"ftp_count"`
	MaxFTP            int    `json:"max_ftp"`
	ShellAccess       bool   `json:"shell_access"`
	WebEngine         string `json:"web_engine"`
	PHPVersion        string `json:"php_version"`
	CreatedAt         string `json:"created_at"`
	SuspendedReason   string `json:"suspended_reason"`
}

type UserAccountService struct {
	mu              sync.RWMutex
	filePath        string
	packagesService *PackagesService
	nginxService    *NginxService
}

var (
	userAccountServiceInstance *UserAccountService
	userAccountOnce            sync.Once
)

func NewUserAccountService() *UserAccountService {
	userAccountOnce.Do(func() {
		_ = os.MkdirAll("/etc/akpanel", 0755)
		_ = os.MkdirAll("/var/www/vhosts", 0755)
		s := &UserAccountService{
			filePath:        "/etc/akpanel/users.json",
			packagesService: NewPackagesService(),
			nginxService:    NewNginxService(),
		}
		s.initDefaultUsers()
		userAccountServiceInstance = s
	})
	return userAccountServiceInstance
}

func (s *UserAccountService) getSystemIP() string {
	cmd := exec.Command("bash", "-c", "hostname -I 2>/dev/null | awk '{print $1}'")
	if out, err := cmd.Output(); err == nil {
		ip := strings.TrimSpace(string(out))
		if ip != "" {
			return ip
		}
	}
	return "127.0.0.1"
}

func (s *UserAccountService) initDefaultUsers() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		serverIP := s.getSystemIP()
		defaultUsers := []UserAccount{
			{
				Username:         "admin",
				Email:            "admin@akpanel.local",
				MainDomain:       "default.local",
				IPAddress:        serverIP,
				SetupTime:        time.Now().Format("2006-01-02 15:04:05"),
				PackageID:        "default",
				PackageName:      "default",
				IsReseller:       false,
				Language:         "en",
				HomeDir:          "/var/www/vhosts/admin",
				Status:           "active",
				DiskUsedMB:       42,
				DiskQuotaMB:      0,
				BandwidthUsedMB:  128,
				BandwidthLimitMB: 0,
				InodesUsed:       1420,
				InodesLimit:      0,
				RAMLimitMB:       2048,
				ActiveProcesses:  3,
				MaxProcesses:     40,
				OpenFilesLimit:   200,
				AutoSSL:          false,
				BackupEnabled:    true,
				DomainsCount:     1,
				MaxDomains:       0,
				DatabasesCount:   1,
				MaxDatabases:     0,
				FTPCount:         1,
				MaxFTP:           0,
				ShellAccess:      true,
				WebEngine:        "nginx",
				PHPVersion:       "8.2",
				CreatedAt:        time.Now().Format("2006-01-02"),
			},
		}

		bytes, _ := json.MarshalIndent(defaultUsers, "", "  ")
		_ = os.WriteFile(s.filePath, bytes, 0644)
	}
}

func (s *UserAccountService) readUsers() ([]UserAccount, error) {
	content, err := os.ReadFile(s.filePath)
	if err != nil {
		return nil, err
	}
	var list []UserAccount
	if err := json.Unmarshal(content, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (s *UserAccountService) writeUsers(list []UserAccount) error {
	bytes, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, bytes, 0644)
}

// ListUsers returns all users enriched with live Linux system telemetry
func (s *UserAccountService) ListUsers() []UserAccount {
	s.mu.Lock()
	defer s.mu.Unlock()

	list, err := s.readUsers()
	if err != nil {
		return []UserAccount{}
	}

	for i := range list {
		u := &list[i]
		// Live Disk Usage calculation (MB)
		if u.HomeDir != "" {
			if _, err := os.Stat(u.HomeDir); err == nil {
				cmd := exec.Command("bash", "-c", fmt.Sprintf("du -sm %s 2>/dev/null | awk '{print $1}'", u.HomeDir))
				if out, err := cmd.Output(); err == nil {
					if mb, err := strconv.Atoi(strings.TrimSpace(string(out))); err == nil {
						u.DiskUsedMB = mb
					}
				}

				// Live Inodes count calculation
				cmdInodes := exec.Command("bash", "-c", fmt.Sprintf("find %s 2>/dev/null | wc -l", u.HomeDir))
				if out, err := cmdInodes.Output(); err == nil {
					if inodes, err := strconv.Atoi(strings.TrimSpace(string(out))); err == nil {
						u.InodesUsed = inodes
					}
				}
			}
		}

		// Live active process count
		cmdProc := exec.Command("bash", "-c", fmt.Sprintf("ps -u %s 2>/dev/null | wc -l", u.Username))
		if out, err := cmdProc.Output(); err == nil {
			if procs, err := strconv.Atoi(strings.TrimSpace(string(out))); err == nil {
				if procs > 1 {
					u.ActiveProcesses = procs - 1
				} else {
					u.ActiveProcesses = 0
				}
			}
		}
	}

	_ = s.writeUsers(list)
	return list
}

func (s *UserAccountService) GetUser(username string) (*UserAccount, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list, err := s.readUsers()
	if err != nil {
		return nil, err
	}
	for _, u := range list {
		if u.Username == username {
			cpy := u
			return &cpy, nil
		}
	}
	return nil, fmt.Errorf("user '%s' not found", username)
}

// CreateUser provisions a complete Linux OS user, directories, limits, and vhost
func (s *UserAccountService) CreateUser(username, password, email, mainDomain, packageID string, shellAccess, isReseller, autoSSL, backupEnabled, createMySQL bool, processLimit, openFilesLimit, inodeLimit int, language, serverIP string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	username = strings.TrimSpace(strings.ToLower(username))
	if username == "" || len(username) < 3 {
		return fmt.Errorf("username must be at least 3 characters")
	}

	list, _ := s.readUsers()
	for _, u := range list {
		if u.Username == username {
			return fmt.Errorf("user '%s' already exists", username)
		}
		if mainDomain != "" && u.MainDomain == mainDomain {
			return fmt.Errorf("domain '%s' is already assigned to user %s", mainDomain, u.Username)
		}
	}

	pkg, err := s.packagesService.GetPackage(packageID)
	if err != nil {
		pkg, _ = s.packagesService.GetPackage("standard")
		if pkg == nil {
			pkg, _ = s.packagesService.GetPackage("starter")
		}
	}

	if serverIP == "" {
		serverIP = s.getSystemIP()
	}
	if language == "" {
		language = "en"
	}
	if processLimit <= 0 {
		processLimit = pkg.Nproc
		if processLimit <= 0 {
			processLimit = 40
		}
	}
	if openFilesLimit <= 0 {
		openFilesLimit = pkg.Nofile
		if openFilesLimit <= 0 {
			openFilesLimit = 200
		}
	}
	if inodeLimit <= 0 {
		inodeLimit = pkg.MaxInodes
	}

	homeDir := fmt.Sprintf("/home/%s", username)
	publicHtml := fmt.Sprintf("%s/public_html", homeDir)

	// 1. Provision Linux System User & Group (Standard CWP/cPanel model)
	shell := "/bin/bash"
	if !shellAccess {
		shell = "/usr/sbin/nologin"
	}

	// Create dedicated primary group for user
	_ = exec.Command("groupadd", "-f", username).Run()

	// Create Linux user with primary group if not exists
	if exec.Command("id", username).Run() != nil {
		userAddCmd := exec.Command("useradd", "-m", "-d", homeDir, "-s", shell, "-g", username, username)
		_ = userAddCmd.Run()
	}

	// Add www-data to user group so web server can read public_html securely
	_ = exec.Command("usermod", "-a", "-G", username, "www-data").Run()

	// Set Linux Password safely via Stdin (no bash -c command injection)
	if password != "" {
		chPassCmd := exec.Command("chpasswd")
		chPassCmd.Stdin = strings.NewReader(fmt.Sprintf("%s:%s\n", username, password))
		_ = chPassCmd.Run()
	}

	// 2. Setup Vhost Directory Structure under /home/<username>
	_ = os.MkdirAll(publicHtml, 0755)
	_ = os.MkdirAll(fmt.Sprintf("%s/logs", homeDir), 0755)
	_ = os.MkdirAll(fmt.Sprintf("%s/ssl", homeDir), 0755)
	_ = os.MkdirAll(fmt.Sprintf("%s/backups", homeDir), 0755)
	_ = os.MkdirAll(fmt.Sprintf("%s/tmp", homeDir), 0755)
	_ = os.MkdirAll(fmt.Sprintf("%s/mail", homeDir), 0755)

	// Create default placeholder index.html
	indexFile := fmt.Sprintf("%s/index.html", publicHtml)
	if _, err := os.Stat(indexFile); os.IsNotExist(err) {
		htmlContent := fmt.Sprintf(`<!DOCTYPE html>
<html lang="%s">
<head>
    <meta charset="UTF-8">
    <title>%s | Hosted on AKpanel</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #121215; padding: 2.5rem; border-radius: 24px; border: 1px solid #27272a; text-align: center; max-width: 520px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
        h1 { color: #38bdf8; margin: 0 0 10px; font-size: 1.8rem; }
        p { color: #a1a1aa; font-size: 0.95rem; line-height: 1.6; }
        .badge { background: #0284c7; color: #fff; padding: 4px 12px; border-radius: 999px; font-size: 0.8rem; font-weight: bold; display: inline-block; margin-bottom: 15px; }
        .meta { margin-top: 20px; padding: 12px; background: #18181b; border-radius: 12px; font-size: 0.8rem; color: #71717a; font-family: monospace; }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">AKpanel Cloud Hosting</div>
        <h1>%s is Live! 🚀</h1>
        <p>Virtual Host provisioned successfully for user <strong>%s</strong> under <em>%s</em> package.</p>
        <div class="meta">Server IP: %s • Engine: %s • PHP %s</div>
    </div>
</body>
</html>`, language, mainDomain, mainDomain, username, pkg.Name, serverIP, pkg.DefaultWebEngine, pkg.DefaultPHPVersion)
		_ = os.WriteFile(indexFile, []byte(htmlContent), 0644)
	}

	// Fix Linux file permissions: chmod 750 /home/<user> with chown <user>:<user>
	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", username, username), homeDir).Run()
	_ = exec.Command("chmod", "750", homeDir).Run()
	_ = exec.Command("chmod", "755", publicHtml).Run()

	// Symlink to /var/www/vhosts and /var/www/sites for multi-system compatibility
	_ = os.MkdirAll("/var/www/vhosts", 0755)
	_ = os.MkdirAll("/var/www/sites", 0755)
	_ = os.Remove(fmt.Sprintf("/var/www/vhosts/%s", username))
	_ = os.Remove(fmt.Sprintf("/var/www/sites/%s", username))
	_ = os.Symlink(homeDir, fmt.Sprintf("/var/www/vhosts/%s", username))
	_ = os.Symlink(homeDir, fmt.Sprintf("/var/www/sites/%s", username))

	// 3. Set Linux OS Resource Limits in /etc/security/limits.d/
	_ = os.MkdirAll("/etc/security/limits.d", 0755)
	limitsContent := fmt.Sprintf("%s soft nproc %d\n%s hard nproc %d\n%s soft nofile %d\n%s hard nofile %d\n",
		username, processLimit, username, processLimit*2, username, openFilesLimit, username, openFilesLimit*2)
	_ = os.WriteFile(fmt.Sprintf("/etc/security/limits.d/%s.conf", username), []byte(limitsContent), 0644)

	// 4. Create Virtual Host in Web Server if domain provided
	if mainDomain != "" {
		_ = s.nginxService.CreateWebsite(WebsiteConfig{
			Domain:       mainDomain,
			RootPath:     publicHtml,
			ServerEngine: pkg.DefaultWebEngine,
			PHPVersion:   pkg.DefaultPHPVersion,
			SiteType:     "php",
		})
	}

	// 5. Create Scoped MySQL User with permissions strictly confined to <username>_%
	if password != "" {
		scopedSql := fmt.Sprintf(
			"CREATE USER IF NOT EXISTS '%s'@'localhost' IDENTIFIED BY '%s';\n"+
				"CREATE USER IF NOT EXISTS '%s'@'127.0.0.1' IDENTIFIED BY '%s';\n"+
				"ALTER USER '%s'@'localhost' IDENTIFIED BY '%s';\n"+
				"ALTER USER '%s'@'127.0.0.1' IDENTIFIED BY '%s';\n"+
				"GRANT ALL PRIVILEGES ON `%s\\_%%`.* TO '%s'@'localhost';\n"+
				"GRANT ALL PRIVILEGES ON `%s\\_%%`.* TO '%s'@'127.0.0.1';\n"+
				"GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'localhost';\n"+
				"GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'127.0.0.1';\n"+
				"FLUSH PRIVILEGES;",
			username, password, username, password, username, password, username, password,
			username, username, username, username, username, username, username, username)
		_ = ExecMySQL(scopedSql)
	}

	// Create default MySQL Database if requested
	databasesCount := 0
	if createMySQL {
		dbName := fmt.Sprintf("%s_db", username)
		createDbSql := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'localhost'; GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'127.0.0.1'; FLUSH PRIVILEGES;",
			dbName, dbName, username, dbName, username)
		_ = ExecMySQL(createDbSql)
		databasesCount = 1
	}

	hash := sha256.Sum256([]byte(password))
	passHash := hex.EncodeToString(hash[:])

	newUser := UserAccount{
		Username:         username,
		Password:         password,
		PasswordHash:     passHash,
		Email:            email,
		MainDomain:       mainDomain,
		IPAddress:        serverIP,
		SetupTime:        time.Now().Format("2006-01-02 15:04:05"),
		PackageID:        pkg.ID,
		PackageName:      pkg.Name,
		IsReseller:       isReseller,
		Language:         language,
		HomeDir:          homeDir,
		Status:           "active",
		DiskUsedMB:       2,
		DiskQuotaMB:      pkg.DiskQuotaMB,
		BandwidthUsedMB:  0,
		BandwidthLimitMB: pkg.BandwidthMB,
		InodesUsed:       15,
		InodesLimit:      inodeLimit,
		RAMLimitMB:       pkg.RAMLimitMB,
		ActiveProcesses:  0,
		MaxProcesses:     processLimit,
		OpenFilesLimit:   openFilesLimit,
		AutoSSL:          autoSSL,
		BackupEnabled:    backupEnabled,
		DomainsCount:     1,
		MaxDomains:       pkg.MaxDomains,
		DatabasesCount:   databasesCount,
		MaxDatabases:     pkg.MySQLDatabases,
		FTPCount:         0,
		MaxFTP:           pkg.FTPAccounts,
		ShellAccess:      shellAccess,
		WebEngine:        pkg.DefaultWebEngine,
		PHPVersion:       pkg.DefaultPHPVersion,
		CreatedAt:        time.Now().Format("2006-01-02"),
	}

	list = append(list, newUser)
	return s.writeUsers(list)
}

// FixPermissions fixes Linux file ownership and permissions for a user
func (s *UserAccountService) FixPermissions(username string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return fmt.Errorf("username required")
	}

	homeDir := fmt.Sprintf("/var/www/vhosts/%s", username)
	if _, err := os.Stat(homeDir); os.IsNotExist(err) {
		return fmt.Errorf("home directory not found: %s", homeDir)
	}

	// 1. Recursive chown
	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:www-data", username), homeDir).Run()

	// 2. Directories 755
	_ = exec.Command("bash", "-c", fmt.Sprintf("find %s -type d -exec chmod 755 {} + 2>/dev/null || true", homeDir)).Run()

	// 3. Files 644
	_ = exec.Command("bash", "-c", fmt.Sprintf("find %s/public_html -type f -exec chmod 644 {} + 2>/dev/null || true", homeDir)).Run()

	return nil
}

// ChangePackage updates user package assignment & limits
func (s *UserAccountService) ChangePackage(username, packageID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	pkg, err := s.packagesService.GetPackage(packageID)
	if err != nil {
		return err
	}

	list, _ := s.readUsers()
	found := false
	for i, u := range list {
		if u.Username == username {
			list[i].PackageID = pkg.ID
			list[i].PackageName = pkg.Name
			list[i].DiskQuotaMB = pkg.DiskQuotaMB
			list[i].BandwidthLimitMB = pkg.BandwidthMB
			list[i].InodesLimit = pkg.MaxInodes
			list[i].RAMLimitMB = pkg.RAMLimitMB
			list[i].MaxProcesses = pkg.Nproc
			list[i].OpenFilesLimit = pkg.Nofile
			list[i].MaxDatabases = pkg.MySQLDatabases
			list[i].MaxFTP = pkg.FTPAccounts
			list[i].WebEngine = pkg.DefaultWebEngine
			list[i].PHPVersion = pkg.DefaultPHPVersion
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("user not found")
	}

	return s.writeUsers(list)
}

// SuspendUser locks user shell & updates status
func (s *UserAccountService) SuspendUser(username, reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	list, _ := s.readUsers()
	found := false
	for i, u := range list {
		if u.Username == username {
			list[i].Status = "suspended"
			list[i].SuspendedReason = reason
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("user not found")
	}

	// Lock Linux OS User account
	_ = exec.Command("usermod", "-L", username).Run()
	_ = exec.Command("usermod", "-s", "/usr/sbin/nologin", username).Run()

	return s.writeUsers(list)
}

// UnsuspendUser unlocks user account
func (s *UserAccountService) UnsuspendUser(username string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	list, _ := s.readUsers()
	found := false
	var userShell bool
	for i, u := range list {
		if u.Username == username {
			list[i].Status = "active"
			list[i].SuspendedReason = ""
			userShell = u.ShellAccess
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("user not found")
	}

	// Unlock Linux OS User
	_ = exec.Command("usermod", "-U", username).Run()
	if userShell {
		_ = exec.Command("usermod", "-s", "/bin/bash", username).Run()
	}

	return s.writeUsers(list)
}

// ResetPassword changes client user Linux password
func (s *UserAccountService) ResetPassword(username, newPassword string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(newPassword) < 6 {
		return fmt.Errorf("password must be at least 6 characters")
	}

	cmd := exec.Command("chpasswd")
	cmd.Stdin = strings.NewReader(fmt.Sprintf("%s:%s\n", username, newPassword))
	return cmd.Run()
}

// DeleteUser deletes account and system user
func (s *UserAccountService) DeleteUser(username string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if username == "root" || username == "admin" {
		return fmt.Errorf("cannot delete root/admin account")
	}

	list, _ := s.readUsers()
	var updated []UserAccount
	var homeDir string
	for _, u := range list {
		if u.Username == username {
			homeDir = u.HomeDir
		} else {
			updated = append(updated, u)
		}
	}

	// Delete Linux OS User & clean directories
	_ = exec.Command("userdel", "-r", username).Run()
	if homeDir != "" && strings.HasPrefix(homeDir, "/var/www/vhosts/") {
		_ = os.RemoveAll(homeDir)
	}

	return s.writeUsers(updated)
}
