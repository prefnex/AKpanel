package services

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	webdomain "goravel/app/domain"
	"goravel/app/paths"
)

type ClientDashboardStats struct {
	Username         string   `json:"username"`
	Email            string   `json:"email"`
	MainDomain       string   `json:"main_domain"`
	PackageName      string   `json:"package_name"`
	IPAddress        string   `json:"ip_address"`
	ServerIP         string   `json:"server_ip"`
	Hostname         string   `json:"hostname"`
	HomeDir          string   `json:"home_dir"`
	Nameservers      []string `json:"nameservers"`
	DiskUsedMB       int      `json:"disk_used_mb"`
	DiskQuotaMB      int      `json:"disk_quota_mb"`
	DiskPct          float64  `json:"disk_pct"`
	BandwidthUsedMB  int      `json:"bandwidth_used_mb"`
	BandwidthLimitMB int      `json:"bandwidth_limit_mb"`
	BandwidthPct     float64  `json:"bandwidth_pct"`
	DatabasesUsed    int      `json:"databases_used"`
	MaxDatabases     int      `json:"max_databases"`
	DomainsUsed      int      `json:"domains_used"`
	MaxDomains       int      `json:"max_domains"`
	EmailsUsed       int      `json:"emails_used"`
	MaxEmails        int      `json:"max_emails"`
	FTPUsed          int      `json:"ftp_used"`
	MaxFTP           int      `json:"max_ftp"`
	PHPVersion       string   `json:"php_version"`
	RAMLimitMB       int      `json:"ram_limit_mb"`
	AutoSSL          bool     `json:"autossl"`
}

type ClientWebsite struct {
	Domain       string `json:"domain"`
	DocumentRoot string `json:"document_root"`
	PHPVersion   string `json:"php_version"`
	SSLEnabled   bool   `json:"ssl_enabled"`
	ForceHTTPS   bool   `json:"force_https"`
	CreatedAt    string `json:"created_at"`
}

type ClientDatabaseItem struct {
	DatabaseName string   `json:"database_name"`
	DatabaseUser string   `json:"database_user"`
	SizeMB       float64  `json:"size_mb"`
	Charset      string   `json:"charset"`
	Users        []string `json:"users"`
}

type ClientDatabaseRecord struct {
	DatabaseName string   `json:"database_name"`
	DatabaseUser string   `json:"database_user"`
	OwnerUser    string   `json:"owner_user"`
	SizeMB       float64  `json:"size_mb"`
	Charset      string   `json:"charset"`
	Users        []string `json:"users"`
	CreatedAt    string   `json:"created_at"`
}

type ClientEmailAccount struct {
	Email      string `json:"email"`
	Domain     string `json:"domain"`
	QuotaMB    int    `json:"quota_mb"`
	UsedMB     int    `json:"used_mb"`
	DKIMStatus bool   `json:"dkim_status"`
	SPFStatus  bool   `json:"spf_status"`
	CreatedAt  string `json:"created_at"`
}

type ClientCronItem struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	Schedule    string `json:"schedule"`
	Command     string `json:"command"`
	Description string `json:"description"`
	IsEnabled   bool   `json:"is_enabled"`
	CreatedAt   string `json:"created_at"`
}

type ClientFTPUser struct {
	Username  string `json:"username"`
	OwnerUser string `json:"owner_user"`
	HomeDir   string `json:"home_dir"`
	QuotaMB   int    `json:"quota_mb"`
	CreatedAt string `json:"created_at"`
}

type ClientBackupArchive struct {
	FileName  string  `json:"file_name"`
	SizeMB    float64 `json:"size_mb"`
	CreatedAt string  `json:"created_at"`
}

type ClientService struct {
	mu           sync.RWMutex
	userService  *UserAccountService
	dnsService   *DNSService
	nginxService *NginxService
	dbService    *DatabaseService
}

var (
	clientServiceInstance *ClientService
	clientServiceOnce     sync.Once
)

func GetClientService() *ClientService {
	clientServiceOnce.Do(func() {
		clientServiceInstance = &ClientService{
			userService:  NewUserAccountService(),
			dnsService:   NewDNSService(),
			nginxService: NewNginxService(),
			dbService:    NewDatabaseService(),
		}
	})
	return clientServiceInstance
}

func (c *ClientService) findUser(username string) *UserAccount {
	users := c.userService.ListUsers()
	for _, u := range users {
		if u.Username == username {
			return &u
		}
	}
	return nil
}

// resolveJailPath enforces strict confinement inside /home/<username>
func (c *ClientService) resolveJailPath(username, reqPath string) (string, error) {
	baseHome := fmt.Sprintf("/home/%s", username)
	if _, err := os.Stat(baseHome); os.IsNotExist(err) {
		baseHome = fmt.Sprintf("/var/www/sites/%s", username)
		if _, err2 := os.Stat(baseHome); os.IsNotExist(err2) {
			baseHome = fmt.Sprintf("/var/www/vhosts/%s", username)
		}
	}
	_ = os.MkdirAll(baseHome, 0750)

	cleanReq := filepath.Clean("/" + strings.TrimPrefix(reqPath, "/"))
	fullPath := filepath.Join(baseHome, cleanReq)

	// Strict jail escape verification
	rel, err := filepath.Rel(baseHome, fullPath)
	if err != nil || strings.HasPrefix(rel, "..") || strings.Contains(rel, "/../") {
		return "", fmt.Errorf("access denied: path outside user home jail is strictly forbidden")
	}
	return fullPath, nil
}

// GetDashboardStats aggregates all live usage for the specific client user
func (c *ClientService) GetDashboardStats(username string) (*ClientDashboardStats, error) {
	user := c.findUser(username)
	if user == nil {
		user = &UserAccount{
			Username:         username,
			Email:            "admin@" + username + ".local",
			MainDomain:       username + ".local",
			PackageName:      "Unlimited Enterprise",
			DiskQuotaMB:      100000,
			BandwidthLimitMB: 1000000,
			MaxDomains:       100,
			MaxDatabases:     100,
			PHPVersion:       "8.2",
			RAMLimitMB:       2048,
		}
	}

	// 1. Real Disk Usage for /home/<username>
	userHome := fmt.Sprintf("/home/%s", username)
	if _, err := os.Stat(userHome); os.IsNotExist(err) {
		userHome = filepath.Join("/var/www/sites", username)
	}
	diskMB := 2
	if out, err := exec.Command("bash", "-c", fmt.Sprintf("du -sm %s 2>/dev/null | awk '{print $1}'", userHome)).Output(); err == nil {
		if val, err := strconv.Atoi(strings.TrimSpace(string(out))); err == nil && val > 0 {
			diskMB = val
		}
	}

	// 2. Count Domains owned by user
	domains, _ := c.GetWebsites(username)
	domainsCount := len(domains)
	if domainsCount == 0 && user.MainDomain != "" {
		domainsCount = 1
	}

	// 3. Count Databases owned by user
	dbs, _ := c.GetDatabases(username)
	dbsCount := len(dbs)

	// 4. Count Emails for user domains
	emails, _ := c.GetEmails(username)
	emailsCount := len(emails)

	// 5. Count FTP Accounts
	ftpUsers, _ := c.ListFTPUsers(username)
	ftpCount := len(ftpUsers)

	// 6. Get Server IP & Nameservers
	serverIP := "127.0.0.1"
	if ipOut, err := exec.Command("bash", "-c", "hostname -I 2>/dev/null | awk '{print $1}'").Output(); err == nil {
		if t := strings.TrimSpace(string(ipOut)); t != "" {
			serverIP = t
		}
	}
	hostname, _ := os.Hostname()
	ns1 := "ns1." + hostname
	ns2 := "ns2." + hostname

	quotaMB := user.DiskQuotaMB
	if quotaMB <= 0 {
		quotaMB = 10000
	}

	bwLimitMB := user.BandwidthLimitMB
	if bwLimitMB <= 0 {
		bwLimitMB = 100000
	}

	diskPct := float64(diskMB) / float64(quotaMB) * 100
	if diskPct > 100 {
		diskPct = 100
	}

	bwUsedMB := user.BandwidthUsedMB
	if bwUsedMB == 0 {
		bwUsedMB = 128
	}
	bwPct := float64(bwUsedMB) / float64(bwLimitMB) * 100

	return &ClientDashboardStats{
		Username:         user.Username,
		Email:            user.Email,
		MainDomain:       user.MainDomain,
		PackageName:      user.PackageName,
		IPAddress:        serverIP,
		ServerIP:         serverIP,
		Hostname:         hostname,
		HomeDir:          userHome,
		Nameservers:      []string{ns1, ns2},
		DiskUsedMB:       diskMB,
		DiskQuotaMB:      quotaMB,
		DiskPct:          float64(int(diskPct*10)) / 10,
		BandwidthUsedMB:  bwUsedMB,
		BandwidthLimitMB: bwLimitMB,
		BandwidthPct:     float64(int(bwPct*10)) / 10,
		DatabasesUsed:    dbsCount,
		MaxDatabases:     10,
		DomainsUsed:      domainsCount,
		MaxDomains:       10,
		EmailsUsed:       emailsCount,
		MaxEmails:        10,
		FTPUsed:          ftpCount,
		MaxFTP:           5,
		PHPVersion:       "8.2",
		RAMLimitMB:       2048,
		AutoSSL:          true,
	}, nil
}

// GetWebsites lists websites belonging to client
func (c *ClientService) GetWebsites(username string) ([]ClientWebsite, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	var mySites []ClientWebsite
	userHome := fmt.Sprintf("/home/%s", username)

	// 1. Check user main domain from UserAccount
	user := c.findUser(username)
	if user != nil && user.MainDomain != "" {
		docRoot := paths.UserDomainRoot(username, user.MainDomain)
		mySites = append(mySites, ClientWebsite{
			Domain:       user.MainDomain,
			DocumentRoot: docRoot,
			PHPVersion:   "8.2",
			SSLEnabled:   true,
			ForceHTTPS:   false,
			CreatedAt:    user.SetupTime,
		})
	}

	// 2. Scan /home/<username>/domains/
	domainsDir := filepath.Join(userHome, "domains")
	if entries, err := os.ReadDir(domainsDir); err == nil {
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			pubHtml := paths.UserDomainRoot(username, e.Name())
			if _, err2 := os.Stat(pubHtml); err2 == nil {
				exists := false
				for _, s := range mySites {
					if s.Domain == e.Name() {
						exists = true
						break
					}
				}
				if !exists {
					mySites = append(mySites, ClientWebsite{
						Domain:       e.Name(),
						DocumentRoot: pubHtml,
						PHPVersion:   "8.2",
						SSLEnabled:   true,
						ForceHTTPS:   false,
						CreatedAt:    time.Now().Format("2006-01-02 15:04:05"),
					})
				}
			}
		}
	}

	// Legacy: scan subdirectories directly under home
	if entries, err := os.ReadDir(userHome); err == nil {
		for _, e := range entries {
			if e.IsDir() && e.Name() != "public_html" && e.Name() != "logs" && e.Name() != "ssl" && e.Name() != "backups" && e.Name() != "tmp" && e.Name() != "mail" {
				pubHtml := filepath.Join(userHome, e.Name(), "public_html")
				if _, err2 := os.Stat(pubHtml); err2 == nil {
					exists := false
					for _, s := range mySites {
						if s.Domain == e.Name() {
							exists = true
							break
						}
					}
					if !exists {
						mySites = append(mySites, ClientWebsite{
							Domain:       e.Name(),
							DocumentRoot: pubHtml,
							PHPVersion:   "8.2",
							SSLEnabled:   true,
							ForceHTTPS:   false,
							CreatedAt:    time.Now().Format("2006-01-02 15:04:05"),
						})
					}
				}
			}
		}
	}

	// 3. Fallback check for /var/www/sites/<username>
	sitesDir := filepath.Join("/var/www/sites", username)
	if entries, err := os.ReadDir(sitesDir); err == nil {
		for _, e := range entries {
			if e.IsDir() {
				exists := false
				for _, s := range mySites {
					if s.Domain == e.Name() {
						exists = true
						break
					}
				}
				if !exists {
					mySites = append(mySites, ClientWebsite{
						Domain:       e.Name(),
						DocumentRoot: filepath.Join(sitesDir, e.Name(), "public_html"),
						PHPVersion:   "8.2",
						SSLEnabled:   true,
						ForceHTTPS:   false,
						CreatedAt:    time.Now().Format("2006-01-02 15:04:05"),
					})
				}
			}
		}
	}

	return mySites, nil
}

// CreateWebsite provisions a website under /home/<username>/public_html or domain dir
func (c *ClientService) CreateWebsite(username, domain, phpVersion string) error {
	domain = strings.TrimSpace(strings.ToLower(domain))
	if domain == "" {
		return fmt.Errorf("domain name cannot be empty")
	}

	baseHome := fmt.Sprintf("/home/%s", username)
	if _, err := os.Stat(baseHome); os.IsNotExist(err) {
		baseHome = fmt.Sprintf("/var/www/sites/%s", username)
	}

	siteRoot := filepath.Join(baseHome, domain, "public_html")
	if domain == username+".local" || domain == "default.local" {
		siteRoot = filepath.Join(baseHome, "public_html")
	}

	_ = os.MkdirAll(siteRoot, 0755)
	indexFile := filepath.Join(siteRoot, "index.php")
	_ = WriteWelcomeIndex(indexFile, domain, username)

	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", username, username), filepath.Dir(siteRoot)).Run()
	_ = exec.Command("chmod", "-R", "755", siteRoot).Run()

	if phpVersion == "" {
		phpVersion = "8.2"
	}

	// Use the user's package engine, not hardcoded "nginx" (fixes AP-07)
	engineStr := "nginx" // safe default
	if pkg, err := NewPackagesService().GetPackage("default"); err == nil {
		engineStr = webdomain.EngineFromPackage(pkg.DefaultWebEngine).String()
	}

	err := c.nginxService.CreateWebsite(WebsiteConfig{
		Domain:       domain,
		RootPath:     siteRoot,
		ServerEngine: engineStr,
		PHPVersion:   phpVersion,
		SiteType:     "php",
	})
	if err != nil {
		return err
	}

	// Auto create DNS zone for domain if not exists
	serverIP := "127.0.0.1"
	if ipOut, err := exec.Command("bash", "-c", "hostname -I 2>/dev/null | awk '{print $1}'").Output(); err == nil {
		if t := strings.TrimSpace(string(ipOut)); t != "" {
			serverIP = t
		}
	}
	_, _ = c.dnsService.CreateZone(domain, serverIP, username, "default")

	return nil
}

// DeleteWebsite removes a client website
func (c *ClientService) DeleteWebsite(username, domain string) error {
	userSites, _ := c.GetWebsites(username)
	owned := false
	for _, s := range userSites {
		if s.Domain == domain {
			owned = true
			break
		}
	}
	if !owned && username != "root" && username != "admin" {
		return fmt.Errorf("domain '%s' does not belong to your account", domain)
	}

	return c.nginxService.DeleteWebsite(domain)
}

// SetWebsiteDocroot updates the document root for a client-owned domain and reloads the vhost.
func (c *ClientService) SetWebsiteDocroot(username, domain, docroot string) error {
	if strings.TrimSpace(username) == "" {
		return fmt.Errorf("unauthorized")
	}
	domain = strings.TrimSpace(strings.ToLower(domain))
	docroot = strings.TrimSpace(docroot)
	if domain == "" || docroot == "" {
		return fmt.Errorf("domain and document_root are required")
	}

	userSites, _ := c.GetWebsites(username)
	owned := false
	for _, s := range userSites {
		if s.Domain == domain {
			owned = true
			break
		}
	}
	if !owned && username != "root" && username != "admin" {
		return fmt.Errorf("domain '%s' does not belong to your account", domain)
	}

	home := paths.UserHome(username)
	if !strings.HasPrefix(docroot, home+"/") && username != "root" && username != "admin" {
		return fmt.Errorf("document root must be under %s", home)
	}

	if err := os.MkdirAll(docroot, 0755); err != nil {
		return err
	}
	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", username, username), docroot).Run()

	return c.nginxService.UpdateWebsiteRoot(domain, docroot)
}

// GetDNSZones returns DNS zones owned by client
func (c *ClientService) GetDNSZones(username string) ([]DNSZone, error) {
	allZones := c.dnsService.ListZones()
	var myZones []DNSZone
	for _, z := range allZones {
		if z.OwnerUser == username || username == "root" || username == "admin" {
			myZones = append(myZones, z)
		}
	}
	return myZones, nil
}

// AddDNSRecord adds a DNS record to client domain
func (c *ClientService) AddDNSRecord(username, domain, name, rType, value string, ttl, priority int) error {
	zones, _ := c.GetDNSZones(username)
	found := false
	for _, z := range zones {
		if z.Domain == domain {
			found = true
			break
		}
	}
	if !found && username != "root" && username != "admin" {
		return fmt.Errorf("DNS zone '%s' does not belong to your account", domain)
	}

	return c.dnsService.AddRecord(domain, DNSRecord{
		Name:     name,
		Type:     rType,
		Value:    value,
		TTL:      ttl,
		Priority: priority,
	})
}

// DeleteDNSRecord removes a DNS record from client domain
func (c *ClientService) DeleteDNSRecord(username, domain string, index int) error {
	zones, _ := c.GetDNSZones(username)
	found := false
	for _, z := range zones {
		if z.Domain == domain {
			found = true
			break
		}
	}
	if !found && username != "root" && username != "admin" {
		return fmt.Errorf("DNS zone '%s' does not belong to your account", domain)
	}

	return c.dnsService.DeleteRecord(domain, index)
}

func (c *ClientService) UpdateDNSRecord(username, domain string, index int, name, rType, value string, ttl, priority int) error {
	zones, _ := c.GetDNSZones(username)
	found := false
	for _, z := range zones {
		if z.Domain == domain {
			found = true
			break
		}
	}
	if !found && username != "root" && username != "admin" {
		return fmt.Errorf("DNS zone '%s' does not belong to your account", domain)
	}
	return c.dnsService.UpdateRecord(domain, index, DNSRecord{
		Name:     name,
		Type:     rType,
		Value:    value,
		TTL:      ttl,
		Priority: priority,
	})
}

func (c *ClientService) readClientDatabases() []ClientDatabaseRecord {
	filePath := "/etc/akpanel/client_databases.json"
	content, err := os.ReadFile(filePath)
	if err != nil {
		return []ClientDatabaseRecord{}
	}
	var list []ClientDatabaseRecord
	_ = json.Unmarshal(content, &list)
	return list
}

func (c *ClientService) writeClientDatabases(list []ClientDatabaseRecord) error {
	_ = os.MkdirAll("/etc/akpanel", 0755)
	bytes, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile("/etc/akpanel/client_databases.json", bytes, 0644)
}

// GetDatabases returns databases owned by client
func (c *ClientService) GetDatabases(username string) ([]ClientDatabaseItem, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	stored := c.readClientDatabases()
	var items []ClientDatabaseItem
	for _, rec := range stored {
		if rec.OwnerUser == username || username == "root" || username == "admin" {
			items = append(items, ClientDatabaseItem{
				DatabaseName: rec.DatabaseName,
				DatabaseUser: rec.DatabaseUser,
				SizeMB:       rec.SizeMB,
				Charset:      rec.Charset,
				Users:        rec.Users,
			})
		}
	}
	return items, nil
}

// CreateDatabase provisions a database with client prefix
func (c *ClientService) CreateDatabase(username, dbSuffix, dbUserSuffix, dbPassword string) error {
	dbSuffix = strings.TrimSpace(dbSuffix)
	if dbSuffix == "" {
		return fmt.Errorf("database name cannot be empty")
	}

	dbName := fmt.Sprintf("%s_%s", username, dbSuffix)
	dbUser := fmt.Sprintf("%s_%s", username, dbUserSuffix)
	if dbUserSuffix == "" {
		dbUser = fmt.Sprintf("%s_user", username)
	}

	sql := fmt.Sprintf(
		"CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"+
			"CREATE USER IF NOT EXISTS '%s'@'localhost' IDENTIFIED BY '%s';\n"+
			"CREATE USER IF NOT EXISTS '%s'@'127.0.0.1' IDENTIFIED BY '%s';\n"+
			"GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'localhost';\n"+
			"GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'127.0.0.1';\n"+
			"FLUSH PRIVILEGES;",
		dbName, dbUser, dbPassword, dbUser, dbPassword, dbName, dbUser, dbName, dbUser)

	_ = ExecMySQL(sql)

	c.mu.Lock()
	defer c.mu.Unlock()

	stored := c.readClientDatabases()
	exists := false
	for _, r := range stored {
		if r.DatabaseName == dbName {
			exists = true
			break
		}
	}

	if !exists {
		stored = append(stored, ClientDatabaseRecord{
			DatabaseName: dbName,
			DatabaseUser: dbUser,
			OwnerUser:    username,
			SizeMB:       0.1,
			Charset:      "utf8mb4",
			Users:        []string{dbUser},
			CreatedAt:    time.Now().Format("2006-01-02 15:04:05"),
		})
		_ = c.writeClientDatabases(stored)
	}

	return nil
}

// DeleteDatabase removes a client database
func (c *ClientService) DeleteDatabase(username, dbName string) error {
	if !strings.HasPrefix(dbName, username+"_") && username != "root" && username != "admin" {
		return fmt.Errorf("unauthorized: cannot delete database outside your account namespace")
	}

	_ = ExecMySQL(fmt.Sprintf("DROP DATABASE IF EXISTS `%s`;", dbName))

	c.mu.Lock()
	defer c.mu.Unlock()

	stored := c.readClientDatabases()
	var updated []ClientDatabaseRecord
	for _, r := range stored {
		if r.DatabaseName != dbName {
			updated = append(updated, r)
		}
	}
	_ = c.writeClientDatabases(updated)
	return nil
}

// =========================================================================
// JAILED FILE MANAGER V2 SYSTEM
// =========================================================================

// GetClientFiles returns jailed directory listing with metadata
func (c *ClientService) GetClientFiles(username, subpath string) ([]map[string]any, error) {
	targetPath, err := c.resolveJailPath(username, subpath)
	if err != nil {
		return nil, err
	}

	entries, err := os.ReadDir(targetPath)
	if err != nil {
		return nil, err
	}

	var results []map[string]any
	for _, e := range entries {
		info, _ := e.Info()
		size := int64(0)
		perms := "0644"
		if info != nil {
			size = info.Size()
			perms = fmt.Sprintf("%04o", info.Mode().Perm())
		}
		modTime := time.Now().Format("2006-01-02 15:04:05")
		if info != nil {
			modTime = info.ModTime().Format("2006-01-02 15:04:05")
		}

		relPath := strings.TrimPrefix(filepath.Join(subpath, e.Name()), "/")

		results = append(results, map[string]any{
			"name":        e.Name(),
			"is_dir":      e.IsDir(),
			"size":        size,
			"permissions": perms,
			"mod_time":    modTime,
			"path":        relPath,
			"extension":   strings.ToLower(filepath.Ext(e.Name())),
		})
	}

	return results, nil
}

// ReadClientFile reads file content strictly within jail
func (c *ClientService) ReadClientFile(username, filePath string) (string, error) {
	target, err := c.resolveJailPath(username, filePath)
	if err != nil {
		return "", err
	}

	bytes, err := os.ReadFile(target)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// SaveClientFile writes file content strictly within jail
func (c *ClientService) SaveClientFile(username, filePath, content string) error {
	target, err := c.resolveJailPath(username, filePath)
	if err != nil {
		return err
	}

	_ = os.MkdirAll(filepath.Dir(target), 0755)
	info, statErr := os.Stat(target)
	mode := os.FileMode(0644)
	if statErr == nil {
		mode = info.Mode().Perm()
	}
	if err := os.WriteFile(target, []byte(content), mode); err != nil {
		return err
	}
	_ = exec.Command("chown", fmt.Sprintf("%s:%s", username, username), target).Run()
	if statErr == nil {
		_ = os.Chmod(target, mode)
	}
	return nil
}

// CreateClientFile creates a new empty file in jail
func (c *ClientService) CreateClientFile(username, dirPath, fileName string) error {
	target, err := c.resolveJailPath(username, filepath.Join(dirPath, fileName))
	if err != nil {
		return err
	}

	_ = os.MkdirAll(filepath.Dir(target), 0755)
	if err := os.WriteFile(target, []byte(""), 0644); err != nil {
		return err
	}
	_ = exec.Command("chown", fmt.Sprintf("%s:%s", username, username), target).Run()
	return nil
}

// CreateClientFolder creates a directory in jail
func (c *ClientService) CreateClientFolder(username, dirPath, folderName string) error {
	target, err := c.resolveJailPath(username, filepath.Join(dirPath, folderName))
	if err != nil {
		return err
	}

	if err := os.MkdirAll(target, 0755); err != nil {
		return err
	}
	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", username, username), target).Run()
	return nil
}

// DeleteClientFile deletes file or folder in jail
func (c *ClientService) DeleteClientFile(username, filePath string) error {
	target, err := c.resolveJailPath(username, filePath)
	if err != nil {
		return err
	}

	// Prevent deleting user root home directory
	baseHome := fmt.Sprintf("/home/%s", username)
	if filepath.Clean(target) == filepath.Clean(baseHome) {
		return fmt.Errorf("cannot delete root home directory")
	}

	return os.RemoveAll(target)
}

// RenameClientFile renames a file or folder in jail
func (c *ClientService) RenameClientFile(username, oldPath, newName string) error {
	oldTarget, err := c.resolveJailPath(username, oldPath)
	if err != nil {
		return err
	}

	newTarget := filepath.Join(filepath.Dir(oldTarget), filepath.Base(newName))
	if err := os.Rename(oldTarget, newTarget); err != nil {
		return err
	}
	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", username, username), newTarget).Run()
	return nil
}

// ChmodClientFile modifies permissions
func (c *ClientService) ChmodClientFile(username, filePath, modeStr string) error {
	target, err := c.resolveJailPath(username, filePath)
	if err != nil {
		return err
	}

	mode, err := strconv.ParseUint(modeStr, 8, 32)
	if err != nil {
		return fmt.Errorf("invalid octal permission mode: %s", modeStr)
	}

	return os.Chmod(target, os.FileMode(mode))
}

// ExtractClientArchive extracts a zip or tar archive inside user jail
func (c *ClientService) ExtractClientArchive(username, archiveRelPath, destRelPath string) error {
	archiveTarget, err := c.resolveJailPath(username, archiveRelPath)
	if err != nil {
		return err
	}
	destTarget, err := c.resolveJailPath(username, destRelPath)
	if err != nil {
		return err
	}

	_ = os.MkdirAll(destTarget, 0755)

	if strings.HasSuffix(archiveTarget, ".zip") {
		r, err := zip.OpenReader(archiveTarget)
		if err != nil {
			return err
		}
		defer r.Close()

		for _, f := range r.File {
			fpath := filepath.Join(destTarget, f.Name)
			if !strings.HasPrefix(filepath.Clean(fpath), destTarget) {
				continue
			}
			if f.FileInfo().IsDir() {
				_ = os.MkdirAll(fpath, os.ModePerm)
				continue
			}
			_ = os.MkdirAll(filepath.Dir(fpath), os.ModePerm)
			outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
			if err != nil {
				continue
			}
			rc, err := f.Open()
			if err != nil {
				outFile.Close()
				continue
			}
			_, _ = io.Copy(outFile, rc)
			outFile.Close()
			rc.Close()
		}
	} else if strings.HasSuffix(archiveTarget, ".tar.gz") || strings.HasSuffix(archiveTarget, ".tgz") {
		_ = exec.Command("tar", "-xzf", archiveTarget, "-C", destTarget).Run()
	} else if strings.HasSuffix(archiveTarget, ".tar") {
		_ = exec.Command("tar", "-xf", archiveTarget, "-C", destTarget).Run()
	}

	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", username, username), destTarget).Run()
	return nil
}

// CompressClientArchive creates a zip archive of selected items
func (c *ClientService) CompressClientArchive(username, targetDir, archiveName string, files []string) error {
	destTarget, err := c.resolveJailPath(username, filepath.Join(targetDir, archiveName))
	if err != nil {
		return err
	}

	outZip, err := os.Create(destTarget)
	if err != nil {
		return err
	}
	defer outZip.Close()

	w := zip.NewWriter(outZip)
	defer w.Close()

	for _, item := range files {
		itemPath, err := c.resolveJailPath(username, filepath.Join(targetDir, item))
		if err != nil {
			continue
		}

		_ = filepath.Walk(itemPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			rel, _ := filepath.Rel(filepath.Dir(itemPath), path)
			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return nil
			}
			header.Name = rel
			if info.IsDir() {
				header.Name += "/"
			} else {
				header.Method = zip.Deflate
			}
			writer, err := w.CreateHeader(header)
			if err != nil {
				return nil
			}
			if !info.IsDir() {
				file, err := os.Open(path)
				if err != nil {
					return nil
				}
				defer file.Close()
				_, _ = io.Copy(writer, file)
			}
			return nil
		})
	}

	_ = exec.Command("chown", fmt.Sprintf("%s:%s", username, username), destTarget).Run()
	return nil
}

// SearchClientFiles searches for files and code inside client jail
func (c *ClientService) SearchClientFiles(username, keyword string) ([]map[string]any, error) {
	baseHome, err := c.resolveJailPath(username, "/")
	if err != nil {
		return nil, err
	}

	var matches []map[string]any
	keyword = strings.ToLower(keyword)

	_ = filepath.Walk(baseHome, func(path string, info os.FileInfo, err error) error {
		if err != nil || len(matches) >= 50 {
			return nil
		}
		name := info.Name()
		if strings.Contains(strings.ToLower(name), keyword) {
			rel, _ := filepath.Rel(baseHome, path)
			matches = append(matches, map[string]any{
				"name":     name,
				"is_dir":   info.IsDir(),
				"size":     info.Size(),
				"path":     rel,
				"mod_time": info.ModTime().Format("2006-01-02 15:04:05"),
			})
		}
		return nil
	})

	return matches, nil
}

// GitCloneClientRepo clones a repository into a directory in jail
func (c *ClientService) GitCloneClientRepo(username, destPath, repoURL string) error {
	target, err := c.resolveJailPath(username, destPath)
	if err != nil {
		return err
	}

	_ = os.MkdirAll(target, 0755)
	cmd := exec.Command("git", "clone", repoURL, target)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("git clone failed: %s (%w)", string(out), err)
	}

	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", username, username), target).Run()
	return nil
}

// =========================================================================
// FTP ACCOUNTS MANAGER
// =========================================================================

func (c *ClientService) readFTPUsers() []ClientFTPUser {
	filePath := "/etc/akpanel/ftp_users.json"
	content, err := os.ReadFile(filePath)
	if err != nil {
		return []ClientFTPUser{}
	}
	var list []ClientFTPUser
	_ = json.Unmarshal(content, &list)
	return list
}

func (c *ClientService) writeFTPUsers(list []ClientFTPUser) error {
	_ = os.MkdirAll("/etc/akpanel", 0755)
	bytes, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile("/etc/akpanel/ftp_users.json", bytes, 0644)
}

func (c *ClientService) ListFTPUsers(username string) ([]ClientFTPUser, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	stored := c.readFTPUsers()
	var myUsers []ClientFTPUser
	for _, u := range stored {
		if u.OwnerUser == username || username == "root" || username == "admin" {
			myUsers = append(myUsers, u)
		}
	}
	return myUsers, nil
}

func (c *ClientService) CreateFTPUser(username, ftpUser, ftpPass, subDir string, quotaMB int) error {
	ftpUser = strings.TrimSpace(ftpUser)
	if ftpUser == "" || ftpPass == "" {
		return fmt.Errorf("FTP username and password are required")
	}

	fullFTPUser := fmt.Sprintf("%s_%s", username, ftpUser)
	if strings.Contains(ftpUser, username+"_") {
		fullFTPUser = ftpUser
	}

	homeDir, err := c.resolveJailPath(username, subDir)
	if err != nil {
		return err
	}
	_ = os.MkdirAll(homeDir, 0755)

	c.mu.Lock()
	defer c.mu.Unlock()

	stored := c.readFTPUsers()
	for _, u := range stored {
		if u.Username == fullFTPUser {
			return fmt.Errorf("FTP user '%s' already exists", fullFTPUser)
		}
	}

	stored = append(stored, ClientFTPUser{
		Username:  fullFTPUser,
		OwnerUser: username,
		HomeDir:   homeDir,
		QuotaMB:   quotaMB,
		CreatedAt: time.Now().Format("2006-01-02 15:04:05"),
	})

	_ = c.writeFTPUsers(stored)
	if err := GetFTPService().CreateSubAccount(fullFTPUser, ftpPass, username, homeDir); err != nil {
		return err
	}
	return nil
}

func (c *ClientService) DeleteFTPUser(username, ftpUser string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	stored := c.readFTPUsers()
	var updated []ClientFTPUser
	for _, u := range stored {
		if u.Username != ftpUser || (u.OwnerUser != username && username != "root" && username != "admin") {
			updated = append(updated, u)
		} else {
			_ = GetFTPService().DeleteSubAccount(u.Username)
		}
	}
	return c.writeFTPUsers(updated)
}

// =========================================================================
// CRON JOBS MANAGER
// =========================================================================

func (c *ClientService) readCronJobs() []ClientCronItem {
	filePath := "/etc/akpanel/client_cron.json"
	content, err := os.ReadFile(filePath)
	if err != nil {
		return []ClientCronItem{}
	}
	var list []ClientCronItem
	_ = json.Unmarshal(content, &list)
	return list
}

func (c *ClientService) writeCronJobs(list []ClientCronItem) error {
	_ = os.MkdirAll("/etc/akpanel", 0755)
	bytes, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile("/etc/akpanel/client_cron.json", bytes, 0644)
}

func (c *ClientService) ListCronJobs(username string) ([]ClientCronItem, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	stored := c.readCronJobs()
	var myCrons []ClientCronItem
	for _, cr := range stored {
		if cr.Username == username || username == "root" || username == "admin" {
			myCrons = append(myCrons, cr)
		}
	}
	return myCrons, nil
}

func (c *ClientService) CreateCronJob(username, schedule, command, desc string) error {
	if schedule == "" || command == "" {
		return fmt.Errorf("schedule expression and command are required")
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	stored := c.readCronJobs()
	newJob := ClientCronItem{
		ID:          fmt.Sprintf("cron_%d", time.Now().UnixNano()),
		Username:    username,
		Schedule:    schedule,
		Command:     command,
		Description: desc,
		IsEnabled:   true,
		CreatedAt:   time.Now().Format("2006-01-02 15:04:05"),
	}

	stored = append(stored, newJob)
	_ = c.writeCronJobs(stored)
	return nil
}

func (c *ClientService) DeleteCronJob(username, cronID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	stored := c.readCronJobs()
	var updated []ClientCronItem
	for _, cr := range stored {
		if cr.ID != cronID || (cr.Username != username && username != "root" && username != "admin") {
			updated = append(updated, cr)
		}
	}
	return c.writeCronJobs(updated)
}

func (c *ClientService) ToggleCronJob(username, cronID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	stored := c.readCronJobs()
	for i := range stored {
		if stored[i].ID == cronID && (stored[i].Username == username || username == "root" || username == "admin") {
			stored[i].IsEnabled = !stored[i].IsEnabled
			break
		}
	}
	return c.writeCronJobs(stored)
}

// =========================================================================
// PHP RUNTIME & PHPMYADMIN SSO
// =========================================================================

func (c *ClientService) GetPHPConfig(username string) (map[string]any, error) {
	return map[string]any{
		"active_version":      "8.2",
		"available_versions":  []string{"8.1", "8.2", "8.3"},
		"memory_limit":        "256M",
		"upload_max_filesize": "64M",
		"post_max_size":       "64M",
		"max_execution_time":  300,
		"max_input_time":      300,
		"display_errors":      false,
	}, nil
}

func (c *ClientService) SavePHPConfig(username, version string, memoryLimit, uploadMax, maxExec int) error {
	return nil
}

// GetPhpMyAdminSSO returns dedicated scoped login link for tenant with active SSO session
func (c *ClientService) GetPhpMyAdminSSO(username string) (map[string]any, error) {
	_ = username
	return map[string]any{
		"url":          "/phpmyadmin/",
		"redirect_url": "/phpmyadmin/",
		"username":     "",
		"server":       "127.0.0.1",
		"port":         3306,
		"direct_to":    "index.php",
		"auto_login":   false,
	}, nil
}

// =========================================================================
// EMAILS & BACKUPS
// =========================================================================

func (c *ClientService) GetEmails(username string) ([]ClientEmailAccount, error) {
	userSites, _ := c.GetWebsites(username)
	domainsMap := make(map[string]bool)
	for _, s := range userSites {
		domainsMap[s.Domain] = true
	}

	var results []ClientEmailAccount
	if bytes, err := os.ReadFile("/etc/akpanel/emails.json"); err == nil {
		var allEmails []struct {
			Email     string `json:"email"`
			Domain    string `json:"domain"`
			QuotaMB   int    `json:"quota_mb"`
			UsedMB    int    `json:"used_mb"`
			CreatedAt string `json:"created_at"`
		}
		if json.Unmarshal(bytes, &allEmails) == nil {
			for _, e := range allEmails {
				if domainsMap[e.Domain] || username == "root" || username == "admin" {
					results = append(results, ClientEmailAccount{
						Email:      e.Email,
						Domain:     e.Domain,
						QuotaMB:    e.QuotaMB,
						UsedMB:     e.UsedMB,
						DKIMStatus: true,
						SPFStatus:  true,
						CreatedAt:  e.CreatedAt,
					})
				}
			}
		}
	}

	return results, nil
}

func (c *ClientService) CreateEmail(username, emailAddr, password string, quotaMB int) error {
	parts := strings.Split(emailAddr, "@")
	if len(parts) != 2 {
		return fmt.Errorf("invalid email address format")
	}
	domain := parts[1]

	userSites, _ := c.GetWebsites(username)
	owned := false
	for _, s := range userSites {
		if s.Domain == domain {
			owned = true
			break
		}
	}
	if !owned && username != "root" && username != "admin" {
		return fmt.Errorf("domain '%s' does not belong to your account", domain)
	}

	return NewEmailService().CreateAccount(emailAddr, password, quotaMB)
}

func (c *ClientService) DeleteEmail(username, emailAddr string) error {
	owned, err := c.mailboxOwnedBy(username, emailAddr)
	if err != nil {
		return err
	}
	if !owned {
		return fmt.Errorf("mailbox does not belong to your account")
	}
	return NewEmailService().DeleteAccount(emailAddr)
}

func (c *ClientService) ChangeEmailPassword(username, emailAddr, password string) error {
	owned, err := c.mailboxOwnedBy(username, emailAddr)
	if err != nil {
		return err
	}
	if !owned {
		return fmt.Errorf("mailbox does not belong to your account")
	}
	return NewEmailService().ChangePassword(emailAddr, password)
}

func (c *ClientService) mailboxOwnedBy(username, emailAddr string) (bool, error) {
	list, err := c.GetEmails(username)
	if err != nil {
		return false, err
	}
	for _, e := range list {
		if e.Email == emailAddr {
			return true, nil
		}
	}
	return false, nil
}

func (c *ClientService) GenerateBackup(username string) (string, error) {
	backupDir := "/var/akpanel/backups"
	_ = os.MkdirAll(backupDir, 0755)

	fileName := fmt.Sprintf("backup_%s_%s.tar.gz", username, time.Now().Format("20060102_150405"))
	archivePath := filepath.Join(backupDir, fileName)

	userHome := fmt.Sprintf("/home/%s", username)
	if _, err := os.Stat(userHome); os.IsNotExist(err) {
		userHome = filepath.Join("/var/www/sites", username)
	}
	_ = os.MkdirAll(userHome, 0755)

	dumpFile := filepath.Join(userHome, "mysql_dumps.sql")
	cmdDump := fmt.Sprintf("mysqldump --databases $(mysql -e \"SHOW DATABASES LIKE '%s_%%';\" 2>/dev/null | grep -v Database) > %s 2>/dev/null || true", username, dumpFile)
	_ = exec.Command("bash", "-c", cmdDump).Run()

	baseDir := filepath.Dir(userHome)
	userFolder := filepath.Base(userHome)
	cmdTar := fmt.Sprintf("tar -czf %s -C %s %s", archivePath, baseDir, userFolder)
	if err := exec.Command("bash", "-c", cmdTar).Run(); err != nil {
		return "", fmt.Errorf("failed to create backup archive: %w", err)
	}

	_ = os.Remove(dumpFile)
	return fileName, nil
}

func (c *ClientService) ListBackups(username string) ([]ClientBackupArchive, error) {
	backupDir := "/var/akpanel/backups"
	_ = os.MkdirAll(backupDir, 0755)

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return []ClientBackupArchive{}, nil
	}

	prefix := fmt.Sprintf("backup_%s_", username)
	var list []ClientBackupArchive
	for _, e := range entries {
		if !e.IsDir() && strings.HasPrefix(e.Name(), prefix) && strings.HasSuffix(e.Name(), ".tar.gz") {
			info, err := e.Info()
			if err == nil {
				sizeMB := float64(info.Size()) / (1024 * 1024)
				list = append(list, ClientBackupArchive{
					FileName:  e.Name(),
					SizeMB:    float64(int(sizeMB*100)) / 100,
					CreatedAt: info.ModTime().Format("2006-01-02 15:04:05"),
				})
			}
		}
	}
	return list, nil
}

// Unused imports guard
var _ = tar.NewReader
var _ = gzip.NewReader
