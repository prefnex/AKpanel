package services

import (
	"encoding/json"
	"os"
	"strings"
	"sync"

	"goravel/app/domain"
	"goravel/app/facades"
	"goravel/app/paths"
)

// InstallConfig holds settings written during installation wizard or default boot
type InstallConfig struct {
	Hostname   string           `json:"hostname"`
	AdminEmail string           `json:"admin_email"`
	Panel      PanelConfig      `json:"panel"`
	Components ComponentsConfig `json:"components"`
	Paths      PathConfig       `json:"paths"`
}

type PanelConfig struct {
	AdminPort         int    `json:"admin_port"`
	ClientPort        int    `json:"client_port"`
	AdminUsername     string `json:"admin_username"`
	AdminPasswordHash string `json:"admin_password_hash"`
	SSLEnabled        bool   `json:"ssl_enabled"`
}

type ComponentsConfig struct {
	WebserverProfile string   `json:"webserver_profile"`
	PHPVersions      []string `json:"php_versions"`
	MariaDB          bool     `json:"mariadb"`
	PostgreSQL       bool     `json:"postgresql"`
	Redis            bool     `json:"redis"`
	BindDNS          bool     `json:"bind_dns"`
	MailStack        bool     `json:"mail_stack"`
	Varnish          bool     `json:"varnish"`
}

type PathConfig struct {
	SitesRoot string `json:"sites_root"`
	UserHomes string `json:"user_homes"`
}

type SecretsConfig struct {
	MySQLRootPassword string `json:"-"`
	JWTSecret         string `json:"-"`
	AppKey            string `json:"-"`
}

// ConfigService coordinates central configuration loading with precedence:
// 1. /etc/akpanel/install.conf (filesystem)
// 2. .env / facades.Config() (Goravel)
// 3. System Environment Variables
type ConfigService struct {
	mu            sync.RWMutex
	installConfig InstallConfig
}

var (
	configServiceInstance *ConfigService
	configServiceOnce     sync.Once
)

// GetConfigService returns the singleton ConfigService instance
func GetConfigService() *ConfigService {
	configServiceOnce.Do(func() {
		s := &ConfigService{}
		s.Reload()
		configServiceInstance = s
	})
	return configServiceInstance
}

// Reload reads /etc/akpanel/install.conf and synchronizes internal values
func (c *ConfigService) Reload() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	conf := InstallConfig{
		Hostname:   "localhost",
		AdminEmail: "admin@localhost",
		Panel: PanelConfig{
			AdminPort:     2087,
			ClientPort:    2083,
			AdminUsername: "root",
			SSLEnabled:    false,
		},
		Components: ComponentsConfig{
			WebserverProfile: "hybrid_nginx_apache",
			PHPVersions:      []string{"8.1", "8.2", "8.3"},
			MariaDB:          true,
			Redis:            true,
			BindDNS:          true,
			MailStack:        true,
			Varnish:          false,
		},
		Paths: PathConfig{
			SitesRoot: paths.SitesRoot,
			UserHomes: paths.UserHomes,
		},
	}

	// 1. Load from /etc/akpanel/install.conf if available
	if data, err := os.ReadFile(paths.InstallConf()); err == nil {
		_ = json.Unmarshal(data, &conf)
	}

	// 2. Check /etc/akpanel/server_profile.conf
	if profBytes, err := os.ReadFile(paths.ServerProfileConf()); err == nil {
		prof := strings.TrimSpace(string(profBytes))
		if prof != "" {
			conf.Components.WebserverProfile = prof
		}
	}

	// 3. Fallback to facades.Config() if set
	if facades.Config() != nil {
		if host := facades.Config().GetString("app.name"); host != "" && host != "Goravel" {
			conf.Hostname = host
		}
	}

	c.installConfig = conf
	return nil
}

// Install returns a copy of the current InstallConfig
func (c *ConfigService) Install() InstallConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.installConfig
}

// Paths returns the configured filesystem paths
func (c *ConfigService) Paths() PathConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.installConfig.Paths
}

// ActiveEngine returns the current canonical WebEngine based on active server profile
func (c *ConfigService) ActiveEngine() domain.WebEngine {
	c.mu.RLock()
	defer c.mu.RUnlock()
	engine, _ := domain.NormalizeEngine(c.installConfig.Components.WebserverProfile)
	return engine
}

// Secrets retrieves sensitive secrets safely (never logs them)
func (c *ConfigService) Secrets() SecretsConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()

	mysqlPass := "akpanel123"
	// Check secret file first
	if passBytes, err := os.ReadFile("/etc/akpanel/secrets/mysql_root"); err == nil {
		if t := strings.TrimSpace(string(passBytes)); t != "" {
			mysqlPass = t
		}
	} else if facades.Config() != nil {
		if envPass := facades.Config().GetString("akpanel.mysql_root_password"); envPass != "" {
			mysqlPass = envPass
		}
	}

	jwtSecret := ""
	if secretBytes, err := os.ReadFile("/etc/akpanel/jwt.secret"); err == nil {
		jwtSecret = strings.TrimSpace(string(secretBytes))
	} else if facades.Config() != nil {
		jwtSecret = facades.Config().GetString("jwt.secret")
	}

	appKey := ""
	if facades.Config() != nil {
		appKey = facades.Config().GetString("app.key")
	}

	return SecretsConfig{
		MySQLRootPassword: mysqlPass,
		JWTSecret:         jwtSecret,
		AppKey:            appKey,
	}
}
