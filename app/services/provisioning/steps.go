package provisioning

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"goravel/app/domain"
	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/paths"
	"goravel/app/services"
)

// ── 1. ValidatePlanStep ───────────────────────────────────────────────────────
type ValidatePlanStep struct{}

func (s *ValidatePlanStep) Name() string { return "ValidatePlan" }

func (s *ValidatePlanStep) Execute(ctx context.Context, plan *ProvisionPlan) error {
	plan.Domain = strings.ToLower(strings.TrimSpace(plan.Domain))
	if plan.Domain == "" {
		return fmt.Errorf("domain name cannot be empty")
	}

	if plan.OwnerUsername == "" {
		plan.OwnerUsername = "root"
	}

	if plan.PackageID == "" {
		plan.PackageID = "default"
	}

	// Normalize engine
	engine, err := domain.NormalizeEngine(string(plan.Engine))
	if err != nil {
		engine = domain.EngineNginx
	}
	plan.Engine = engine

	if plan.PHPVersion == "" {
		plan.PHPVersion = "8.2"
	}
	if plan.TemplateID == "" {
		if plan.IsClientSite {
			plan.TemplateID = "custom"
		} else {
			plan.TemplateID = "laravel"
		}
	}
	if plan.SiteType == "" {
		plan.SiteType = "php"
	}
	if plan.RootPath == "" {
		plan.RootPath = paths.ResolveWebsiteRoot(plan.OwnerUsername, plan.Domain)
	}

	// Check if already registered in database
	if facades.Orm() != nil {
		count, _ := facades.Orm().Query().Model(&models.Website{}).Where("domain = ?", plan.Domain).Count()
		if count > 0 {
			return fmt.Errorf("website '%s' is already registered in database", plan.Domain)
		}
	}

	// Resolve server IP if empty
	if plan.ServerIP == "" {
		plan.ServerIP = "127.0.0.1"
		if ipOut, err := exec.Command("bash", "-c", "hostname -I 2>/dev/null | awk '{print $1}'").Output(); err == nil {
			if t := strings.TrimSpace(string(ipOut)); t != "" {
				plan.ServerIP = t
			}
		}
	}

	return nil
}

func (s *ValidatePlanStep) Rollback(ctx context.Context, plan *ProvisionPlan) error {
	return nil
}

// ── 2. CreateDirectoriesStep ──────────────────────────────────────────────────
type CreateDirectoriesStep struct {
	createdDir bool
}

func (s *CreateDirectoriesStep) Name() string { return "CreateDirectories" }

func (s *CreateDirectoriesStep) Execute(ctx context.Context, plan *ProvisionPlan) error {
	if _, err := os.Stat(plan.RootPath); os.IsNotExist(err) {
		if err := os.MkdirAll(plan.RootPath, 0755); err != nil {
			return fmt.Errorf("failed to create document root %s: %w", plan.RootPath, err)
		}
		s.createdDir = true
	}

	// Create starter index file if empty
	indexPhp := filepath.Join(plan.RootPath, "index.php")
	indexHtml := filepath.Join(plan.RootPath, "index.html")
	if _, errHtml := os.Stat(indexHtml); os.IsNotExist(errHtml) {
		_ = services.WriteWelcomeIndex(indexPhp, plan.Domain, plan.OwnerUsername)
	}

	// Set ownership
	if plan.OwnerUsername == "root" || plan.OwnerUsername == "admin" || plan.OwnerUsername == "" {
		_ = exec.Command("chown", "-R", "www-data:www-data", filepath.Dir(plan.RootPath)).Run()
	} else {
		_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", plan.OwnerUsername, plan.OwnerUsername), plan.RootPath).Run()
		_ = exec.Command("chmod", "-R", "755", plan.RootPath).Run()
	}

	return nil
}

func (s *CreateDirectoriesStep) Rollback(ctx context.Context, plan *ProvisionPlan) error {
	if s.createdDir && plan.RootPath != "" && plan.RootPath != "/" {
		_ = os.RemoveAll(plan.RootPath)
	}
	return nil
}

// ── 3. CreateWebServersStep ───────────────────────────────────────────────────
type CreateWebServersStep struct {
	nginxService *services.NginxService
}

func NewCreateWebServersStep() *CreateWebServersStep {
	return &CreateWebServersStep{
		nginxService: services.NewNginxService(),
	}
}

func (s *CreateWebServersStep) Name() string { return "CreateWebServers" }

func (s *CreateWebServersStep) Execute(ctx context.Context, plan *ProvisionPlan) error {
	cfg := services.WebsiteConfig{
		Domain:       plan.Domain,
		ServerEngine: string(plan.Engine),
		TemplateID:   plan.TemplateID,
		PHPVersion:   plan.PHPVersion,
		SiteType:     plan.SiteType,
		ProxyPort:    plan.ProxyPort,
		RootPath:     plan.RootPath,
	}
	return s.nginxService.CreateWebsite(cfg)
}

func (s *CreateWebServersStep) Rollback(ctx context.Context, plan *ProvisionPlan) error {
	if s.nginxService != nil {
		_ = s.nginxService.DeleteWebsite(plan.Domain)
	}
	return nil
}

// ── 4. CreateDNSStep ──────────────────────────────────────────────────────────
type CreateDNSStep struct {
	dnsService *services.DNSService
}

func NewCreateDNSStep() *CreateDNSStep {
	return &CreateDNSStep{
		dnsService: services.NewDNSService(),
	}
}

func (s *CreateDNSStep) Name() string { return "CreateDNS" }

func (s *CreateDNSStep) Execute(ctx context.Context, plan *ProvisionPlan) error {
	if !plan.CreateDNS || s.dnsService == nil {
		return nil
	}
	_, err := s.dnsService.CreateZone(plan.Domain, plan.ServerIP, plan.OwnerUsername, plan.PackageID)
	return err
}

func (s *CreateDNSStep) Rollback(ctx context.Context, plan *ProvisionPlan) error {
	if plan.CreateDNS && s.dnsService != nil {
		_ = s.dnsService.DeleteZone(plan.Domain)
	}
	return nil
}

// ── 5. SaveDatabaseStep ───────────────────────────────────────────────────────
type SaveDatabaseStep struct {
	createdRecord bool
}

func (s *SaveDatabaseStep) Name() string { return "SaveDatabase" }

func (s *SaveDatabaseStep) Execute(ctx context.Context, plan *ProvisionPlan) error {
	if facades.Orm() == nil {
		return nil
	}

	website := models.Website{
		Domain:        plan.Domain,
		OwnerUsername: plan.OwnerUsername,
		PackageID:     plan.PackageID,
		Status:        "active",
		ServerEngine:  string(plan.Engine),
		TemplateID:    plan.TemplateID,
		PHPVersion:    plan.PHPVersion,
		SiteType:      plan.SiteType,
		ProxyPort:     plan.ProxyPort,
		RootPath:      plan.RootPath,
		SSLActive:     plan.CreateSSL,
	}

	if err := facades.Orm().Query().Create(&website); err != nil {
		return fmt.Errorf("failed to save website to database: %w", err)
	}

	s.createdRecord = true
	plan.ResultWebsite = &website
	return nil
}

func (s *SaveDatabaseStep) Rollback(ctx context.Context, plan *ProvisionPlan) error {
	if s.createdRecord && facades.Orm() != nil {
		_, _ = facades.Orm().Query().Where("domain = ?", plan.Domain).Delete(&models.Website{})
	}
	return nil
}

// ── 6. IssueSSLStep ───────────────────────────────────────────────────────────
type IssueSSLStep struct {
	acmeService *services.ACMEService
}

func NewIssueSSLStep() *IssueSSLStep {
	return &IssueSSLStep{
		acmeService: services.NewACMEService(),
	}
}

func (s *IssueSSLStep) Name() string { return "IssueSSL" }

func (s *IssueSSLStep) Execute(ctx context.Context, plan *ProvisionPlan) error {
	if !plan.CreateSSL || s.acmeService == nil {
		return nil
	}
	_, err := s.acmeService.IssueSSL(plan.Domain, "", plan.RootPath)
	return err
}

func (s *IssueSSLStep) Rollback(ctx context.Context, plan *ProvisionPlan) error {
	return nil
}
