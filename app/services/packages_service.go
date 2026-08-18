package services

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"
)

type HostingPackage struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	DiskQuotaMB       int    `json:"disk_quota_mb"`      // 0 = Unlimited
	BandwidthMB       int    `json:"bandwidth_mb"`       // 0 = Unlimited
	RAMLimitMB        int    `json:"ram_limit_mb"`       // In MB
	FTPAccounts       int    `json:"ftp_accounts"`       // Max FTP
	EmailAccounts     int    `json:"email_accounts"`     // Max Email
	EmailLists        int    `json:"email_lists"`        // Max Email Lists
	MySQLDatabases    int    `json:"mysql_databases"`    // Max MySQL DBs
	MaxDomains        int    `json:"max_domains"`        // Max Domains
	SubDomains        int    `json:"sub_domains"`        // Max Subdomains
	ParkedDomains     int    `json:"parked_domains"`     // Max Parked Domains
	AddonDomains      int    `json:"addon_domains"`      // Max Addon Domains
	HourlyEmails      int    `json:"hourly_emails"`      // Hourly email sending cap
	CgroupsPolicy     string `json:"cgroups_policy"`     // None policy, Standard, High-Perf
	Nproc             int    `json:"nproc"`              // Process limit
	ApacheNproc       int    `json:"apache_nproc"`       // Web server process limit
	MaxInodes         int    `json:"max_inodes"`         // Inode limit (0 = Unlimited)
	Nofile            int    `json:"nofile"`             // Open files limit (e.g. 200, 1024)
	NodejsApps        int    `json:"nodejs_apps"`        // Max Node.js instances
	PackageType       string `json:"package_type"`       // General, Reseller, VIP
	DefaultWebEngine  string `json:"default_web_engine"` // nginx, apache, nginx+apache, varnish+nginx+apache
	DefaultPHPVersion string `json:"default_php_version"`// 8.1, 8.2, 8.3
	ShellAccess       bool   `json:"shell_access"`
	UsersCount        int    `json:"users_count"`
	CreatedAt         string `json:"created_at"`
}

type PackagesService struct {
	mu       sync.RWMutex
	filePath string
}

var (
	packagesServiceInstance *PackagesService
	packagesOnce            sync.Once
)

func NewPackagesService() *PackagesService {
	packagesOnce.Do(func() {
		_ = os.MkdirAll("/etc/akpanel", 0755)
		s := &PackagesService{
			filePath: "/etc/akpanel/packages.json",
		}
		s.initDefaultPackages()
		packagesServiceInstance = s
	})
	return packagesServiceInstance
}

func (s *PackagesService) initDefaultPackages() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		defaults := []HostingPackage{
			{
				ID:                "starter",
				Name:              "Starter Cloud",
				DiskQuotaMB:       5120, // 5 GB
				BandwidthMB:       51200, // 50 GB
				RAMLimitMB:        512,
				FTPAccounts:       2,
				EmailAccounts:     5,
				EmailLists:        2,
				MySQLDatabases:    3,
				SubDomains:        5,
				ParkedDomains:     2,
				AddonDomains:      1,
				HourlyEmails:      50,
				CgroupsPolicy:     "None policy",
				Nproc:             25,
				ApacheNproc:       25,
				MaxInodes:         100000,
				Nofile:            200,
				NodejsApps:        1,
				PackageType:       "General",
				DefaultWebEngine:  "nginx",
				DefaultPHPVersion: "8.2",
				ShellAccess:       false,
				CreatedAt:         time.Now().Format("2006-01-02"),
			},
			{
				ID:                "standard",
				Name:              "Standard Pro",
				DiskQuotaMB:       20480, // 20 GB
				BandwidthMB:       1048576, // 1 TB
				RAMLimitMB:        1024,
				FTPAccounts:       5,
				EmailAccounts:     20,
				EmailLists:        5,
				MySQLDatabases:    10,
				SubDomains:        20,
				ParkedDomains:     5,
				AddonDomains:      5,
				HourlyEmails:      100,
				CgroupsPolicy:     "Standard",
				Nproc:             40,
				ApacheNproc:       40,
				MaxInodes:         350000,
				Nofile:            200,
				NodejsApps:        2,
				PackageType:       "General",
				DefaultWebEngine:  "nginx+apache",
				DefaultPHPVersion: "8.2",
				ShellAccess:       true,
				CreatedAt:         time.Now().Format("2006-01-02"),
			},
			{
				ID:                "enterprise",
				Name:              "Enterprise Cluster",
				DiskQuotaMB:       102400, // 100 GB
				BandwidthMB:       5242880, // 5 TB
				RAMLimitMB:        4096,
				FTPAccounts:       20,
				EmailAccounts:     100,
				EmailLists:        20,
				MySQLDatabases:    50,
				SubDomains:        100,
				ParkedDomains:     20,
				AddonDomains:      20,
				HourlyEmails:      500,
				CgroupsPolicy:     "High-Perf",
				Nproc:             100,
				ApacheNproc:       100,
				MaxInodes:         1000000,
				Nofile:            1024,
				NodejsApps:        10,
				PackageType:       "VIP",
				DefaultWebEngine:  "varnish+nginx+apache",
				DefaultPHPVersion: "8.3",
				ShellAccess:       true,
				CreatedAt:         time.Now().Format("2006-01-02"),
			},
			{
				ID:                "default",
				Name:              "default",
				DiskQuotaMB:       0, // Unlimited
				BandwidthMB:       0, // Unlimited
				RAMLimitMB:        2048,
				FTPAccounts:       0,
				EmailAccounts:     0,
				EmailLists:        0,
				MySQLDatabases:    0,
				SubDomains:        0,
				ParkedDomains:     0,
				AddonDomains:      0,
				HourlyEmails:      100,
				CgroupsPolicy:     "None policy",
				Nproc:             40,
				ApacheNproc:       40,
				MaxInodes:         0,
				Nofile:            200,
				NodejsApps:        1,
				PackageType:       "General",
				DefaultWebEngine:  "nginx",
				DefaultPHPVersion: "8.2",
				ShellAccess:       true,
				CreatedAt:         time.Now().Format("2006-01-02"),
			},
		}

		bytes, _ := json.MarshalIndent(defaults, "", "  ")
		_ = os.WriteFile(s.filePath, bytes, 0644)
	}
}

func (s *PackagesService) readPackages() ([]HostingPackage, error) {
	content, err := os.ReadFile(s.filePath)
	if err != nil {
		return nil, err
	}
	var list []HostingPackage
	if err := json.Unmarshal(content, &list); err != nil {
		return nil, err
	}
	return list, nil
}

func (s *PackagesService) writePackages(list []HostingPackage) error {
	bytes, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, bytes, 0644)
}

func (s *PackagesService) ListPackages() []HostingPackage {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list, err := s.readPackages()
	if err != nil {
		return []HostingPackage{}
	}
	return list
}

func (s *PackagesService) GetPackage(id string) (*HostingPackage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list, err := s.readPackages()
	if err != nil {
		return nil, err
	}

	for _, p := range list {
		if p.ID == id {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("package not found: %s", id)
}

func (s *PackagesService) SavePackage(pkg HostingPackage) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	list, _ := s.readPackages()

	if pkg.ID == "" {
		pkg.ID = fmt.Sprintf("pkg_%d", time.Now().Unix())
	}
	if pkg.CreatedAt == "" {
		pkg.CreatedAt = time.Now().Format("2006-01-02")
	}

	found := false
	for i, p := range list {
		if p.ID == pkg.ID {
			list[i] = pkg
			found = true
			break
		}
	}
	if !found {
		list = append(list, pkg)
	}

	return s.writePackages(list)
}

func (s *PackagesService) DeletePackage(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	list, _ := s.readPackages()
	var updated []HostingPackage
	for _, p := range list {
		if p.ID != id {
			updated = append(updated, p)
		}
	}
	return s.writePackages(updated)
}
