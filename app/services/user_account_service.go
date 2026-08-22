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

	"goravel/app/facades"
	"goravel/app/paths"
)

type UserAccount struct {
	Username         string `json:"username"`
	Password         string `json:"password,omitempty"`
	PasswordHash     string `json:"password_hash,omitempty"`
	Email            string `json:"email"`
	MainDomain       string `json:"main_domain"`
	IPAddress        string `json:"ip_address"`
	SetupTime        string `json:"setup_time"`
	PackageID        string `json:"package_id"`
	PackageName      string `json:"package_name"`
	IsReseller       bool   `json:"is_reseller"`
	Language         string `json:"language"`
	HomeDir          string `json:"home_dir"`
	Status           string `json:"status"` // active, suspended
	DiskUsedMB       int    `json:"disk_used_mb"`
	DiskQuotaMB      int    `json:"disk_quota_mb"`
	BandwidthUsedMB  int    `json:"bandwidth_used_mb"`
	BandwidthLimitMB int    `json:"bandwidth_limit_mb"`
	InodesUsed       int    `json:"inodes_used"`
	InodesLimit      int    `json:"inodes_limit"`
	RAMLimitMB       int    `json:"ram_limit_mb"`
	ActiveProcesses  int    `json:"active_processes"`
	MaxProcesses     int    `json:"max_processes"`
	OpenFilesLimit   int    `json:"open_files_limit"` // nofile
	AutoSSL          bool   `json:"autossl"`
	BackupEnabled    bool   `json:"backup_enabled"`
	DomainsCount     int    `json:"domains_count"`
	MaxDomains       int    `json:"max_domains"`
	DatabasesCount   int    `json:"databases_count"`
	MaxDatabases     int    `json:"max_databases"`
	FTPCount         int    `json:"ftp_count"`
	MaxFTP           int    `json:"max_ftp"`
	ShellAccess      bool   `json:"shell_access"`
	WebEngine        string `json:"web_engine"`
	PHPVersion       string `json:"php_version"`
	CreatedAt        string `json:"created_at"`
	SuspendedReason  string `json:"suspended_reason"`
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
		_ = os.MkdirAll(paths.EtcAKpanel, 0755)
		_ = os.MkdirAll("/var/www/vhosts", 0755)
		s := &UserAccountService{
			filePath:        paths.UsersJSON(),
			packagesService: NewPackagesService(),
			nginxService:    NewNginxService(),
		}
		s.initDefaultUsers()
		EnsureSSHJail()
		EnsureAccountStatusPage()
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
		defaultUsers := []UserAccount{}
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

		RefreshAccountHold(*u)
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

// FixPermissions fixes Linux file ownership and permissions for a user (user:user isolation model).
func (s *UserAccountService) FixPermissions(username string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return fmt.Errorf("username required")
	}

	homeDir := paths.UserHome(username)
	if _, err := os.Stat(homeDir); os.IsNotExist(err) {
		return fmt.Errorf("home directory not found: %s", homeDir)
	}

	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", username, username), homeDir).Run()
	_ = exec.Command("chmod", "711", homeDir).Run()
	_ = exec.Command("bash", "-c", fmt.Sprintf("find %s/domains -type d -exec chmod 755 {} + 2>/dev/null || true", homeDir)).Run()
	_ = exec.Command("bash", "-c", fmt.Sprintf("find %s/domains -type f -exec chmod 644 {} + 2>/dev/null || true", homeDir)).Run()

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

	if err := s.writeUsers(list); err != nil {
		return err
	}
	for _, u := range list {
		if u.Username == username {
			RefreshAccountHold(u)
			break
		}
	}
	return nil
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
	ApplySSHJailToUser(username, userShell)

	if err := s.writeUsers(list); err != nil {
		return err
	}
	for _, u := range list {
		if u.Username == username {
			RefreshAccountHold(u)
			break
		}
	}
	return nil
}

type UserUpdateRequest struct {
	Email            string `json:"email"`
	IPAddress        string `json:"ip_address"`
	PackageID        string `json:"package_id"`
	IsReseller       bool   `json:"is_reseller"`
	ShellAccess      bool   `json:"shell_access"`
	AutoSSL          bool   `json:"autossl"`
	BackupEnabled    bool   `json:"backup_enabled"`
	DiskQuotaMB      int    `json:"disk_quota_mb"`
	BandwidthLimitMB int    `json:"bandwidth_limit_mb"`
	InodesLimit      int    `json:"inodes_limit"`
	MaxProcesses     int    `json:"max_processes"`
	OpenFilesLimit   int    `json:"open_files_limit"`
}

// ResetPassword changes client user Linux password, MySQL password, FTP password, and AKpanel auth hash
func (s *UserAccountService) ResetPassword(username, newPassword string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(newPassword) < 6 {
		return fmt.Errorf("password must be at least 6 characters")
	}

	// 1. Linux PAM / shadow (SSH, SFTP, Unix FTP)
	cmd := exec.Command("chpasswd")
	cmd.Stdin = strings.NewReader(fmt.Sprintf("%s:%s\n", username, newPassword))
	_ = cmd.Run()

	// 2. MySQL / MariaDB account with the same password (no shell interpolation)
	escUser := strings.ReplaceAll(username, "'", "")
	escPass := strings.ReplaceAll(strings.ReplaceAll(newPassword, `\`, `\\`), "'", "''")
	_ = ExecMySQL(fmt.Sprintf(
		"CREATE USER IF NOT EXISTS '%s'@'localhost' IDENTIFIED BY '%s'; ALTER USER '%s'@'localhost' IDENTIFIED BY '%s'; CREATE USER IF NOT EXISTS '%s'@'127.0.0.1' IDENTIFIED BY '%s'; ALTER USER '%s'@'127.0.0.1' IDENTIFIED BY '%s'; GRANT ALL PRIVILEGES ON `%s\\_%%`.* TO '%s'@'localhost'; GRANT ALL PRIVILEGES ON `%s\\_%%`.* TO '%s'@'127.0.0.1'; FLUSH PRIVILEGES;",
		escUser, escPass, escUser, escPass, escUser, escPass, escUser, escPass, escUser, escUser, escUser, escUser,
	))

	// 3. Pure-FTPd virtual map + mkdb (UnixAuthentication still uses shadow from step 1)
	_ = GetFTPService().SetPrimaryPassword(username, newPassword)
	_ = GetRedisService().SetUserPassword(username, newPassword)
	PersistAccountMySQLPassword(username, newPassword)

	// 4. Update AKpanel Client Portal auth hash in users.json
	list, _ := s.readUsers()
	passHash := ""
	if facades.Hash() != nil {
		if bHash, err := facades.Hash().Make(newPassword); err == nil {
			passHash = bHash
		}
	}
	if passHash == "" {
		hash := sha256.Sum256([]byte(newPassword))
		passHash = hex.EncodeToString(hash[:])
	}

	for i := range list {
		if list[i].Username == username {
			list[i].Password = "" // Never store plaintext
			list[i].PasswordHash = passHash
			break
		}
	}

	return s.writeUsers(list)
}

// UpdateUser modifies user account settings, packages, quotas, IP, and shell access
func (s *UserAccountService) UpdateUser(username string, req UserUpdateRequest) (*UserAccount, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	list, _ := s.readUsers()
	var updatedUser *UserAccount

	for i := range list {
		if list[i].Username == username {
			if req.Email != "" {
				list[i].Email = req.Email
			}
			if req.IPAddress != "" {
				list[i].IPAddress = req.IPAddress
			}
			if req.PackageID != "" {
				list[i].PackageID = req.PackageID
				if pkg, err := s.packagesService.GetPackage(req.PackageID); err == nil && pkg != nil {
					list[i].PackageName = pkg.Name
					if req.DiskQuotaMB <= 0 {
						list[i].DiskQuotaMB = pkg.DiskQuotaMB
					}
					if req.BandwidthLimitMB <= 0 {
						list[i].BandwidthLimitMB = pkg.BandwidthMB
					}
					if req.InodesLimit <= 0 {
						list[i].InodesLimit = pkg.MaxInodes
					}
					if req.MaxProcesses <= 0 {
						list[i].MaxProcesses = pkg.Nproc
					}
					if req.OpenFilesLimit <= 0 {
						list[i].OpenFilesLimit = pkg.Nofile
					}
				}
			}
			if req.DiskQuotaMB > 0 {
				list[i].DiskQuotaMB = req.DiskQuotaMB
			}
			if req.BandwidthLimitMB > 0 {
				list[i].BandwidthLimitMB = req.BandwidthLimitMB
			}
			if req.InodesLimit > 0 {
				list[i].InodesLimit = req.InodesLimit
			}
			if req.MaxProcesses > 0 {
				list[i].MaxProcesses = req.MaxProcesses
			}
			if req.OpenFilesLimit > 0 {
				list[i].OpenFilesLimit = req.OpenFilesLimit
			}

			list[i].IsReseller = req.IsReseller
			list[i].AutoSSL = req.AutoSSL
			list[i].BackupEnabled = req.BackupEnabled

			if list[i].ShellAccess != req.ShellAccess {
				list[i].ShellAccess = req.ShellAccess
				ApplySSHJailToUser(username, req.ShellAccess)
			}

			updatedUser = &list[i]
			break
		}
	}

	if updatedUser == nil {
		return nil, fmt.Errorf("user '%s' not found", username)
	}

	if err := s.writeUsers(list); err != nil {
		return nil, err
	}

	return updatedUser, nil
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
	_ = GetRedisService().DeleteUser(username)
	if homeDir != "" && (strings.HasPrefix(homeDir, "/home/") || strings.HasPrefix(homeDir, "/var/www/vhosts/")) {
		_ = os.RemoveAll(homeDir)
	}
	if strings.HasPrefix(paths.UserHome(username), "/home/") {
		_ = os.RemoveAll(paths.UserHome(username))
	}

	return s.writeUsers(updated)
}

// SaveUser updates or appends a UserAccount record in users.json
func (s *UserAccountService) SaveUser(user UserAccount) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	list, _ := s.readUsers()
	found := false
	for i := range list {
		if list[i].Username == user.Username {
			list[i] = user
			found = true
			break
		}
	}
	if !found {
		list = append(list, user)
	}

	return s.writeUsers(list)
}
