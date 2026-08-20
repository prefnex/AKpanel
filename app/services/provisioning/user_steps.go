package provisioning

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"goravel/app/domain"
	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/paths"
	"goravel/app/services"
	"goravel/app/services/dbengines"
	"goravel/app/services/tasks"
)

func progressLog(plan *UserProvisionPlan, step string, pct int, msg string) {
	if plan.TaskID == "" {
		return
	}
	_ = tasks.GetRegistry().UpdateProgress(plan.TaskID, step, pct, msg)
}

// ── 1. ValidateUserPlan ───────────────────────────────────────────────────────

type ValidateUserPlanStep struct{}

func (s *ValidateUserPlanStep) Name() string { return "ValidateUserPlan" }

func (s *ValidateUserPlanStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	plan.Username = strings.TrimSpace(strings.ToLower(plan.Username))
	if len(plan.Username) < 3 {
		return fmt.Errorf("username must be at least 3 characters")
	}
	if plan.Password == "" {
		return fmt.Errorf("password is required")
	}

	uas := services.NewUserAccountService()
	if _, err := uas.GetUser(plan.Username); err == nil {
		return fmt.Errorf("user '%s' already exists", plan.Username)
	}

	pkgSvc := services.NewPackagesService()
	pkg, err := pkgSvc.GetPackage(plan.PackageID)
	if err != nil {
		pkg, _ = pkgSvc.GetPackage("standard")
		if pkg == nil {
			pkg, _ = pkgSvc.GetPackage("starter")
		}
	}
	if pkg != nil {
		plan.PackageID = pkg.ID
		plan.PackageName = pkg.Name
		plan.PHPVersion = pkg.DefaultPHPVersion
		plan.WebEngine = pkg.DefaultWebEngine
		if plan.ProcessLimit <= 0 {
			plan.ProcessLimit = pkg.Nproc
		}
		if plan.OpenFilesLimit <= 0 {
			plan.OpenFilesLimit = pkg.Nofile
		}
		if plan.InodeLimit <= 0 {
			plan.InodeLimit = pkg.MaxInodes
		}
	}
	if plan.PHPVersion == "" {
		plan.PHPVersion = "8.2"
	}
	if plan.ProcessLimit <= 0 {
		plan.ProcessLimit = 40
	}
	if plan.OpenFilesLimit <= 0 {
		plan.OpenFilesLimit = 200
	}
	if plan.Language == "" {
		plan.Language = "en"
	}
	if plan.ServerIP == "" {
		plan.ServerIP = "127.0.0.1"
		if out, err := exec.Command("bash", "-c", "hostname -I 2>/dev/null | awk '{print $1}'").Output(); err == nil {
			if ip := strings.TrimSpace(string(out)); ip != "" {
				plan.ServerIP = ip
			}
		}
	}

	plan.HomeDir = paths.UserHome(plan.Username)
	if plan.MainDomain != "" {
		plan.RootPath = paths.UserDomainRoot(plan.Username, plan.MainDomain)
	} else {
		plan.RootPath = paths.UserLegacyDomainRoot(plan.Username)
	}

	progressLog(plan, s.Name(), 5, fmt.Sprintf("Validated plan for user %s", plan.Username))
	return nil
}

func (s *ValidateUserPlanStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	return nil
}

// ── 2. DetectEngines ──────────────────────────────────────────────────────────

type DetectEnginesStep struct{}

func (s *DetectEnginesStep) Name() string { return "DetectEngines" }

func (s *DetectEnginesStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	engines := dbengines.DetectAvailable()
	var names []string
	for _, e := range engines {
		if e.Available {
			names = append(names, e.Name)
		}
	}
	progressLog(plan, s.Name(), 10, fmt.Sprintf("Detected DB engines: %v", names))
	return nil
}

func (s *DetectEnginesStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	return nil
}

// ── 3. CreateLinuxUser ────────────────────────────────────────────────────────

type CreateLinuxUserStep struct {
	created bool
}

func (s *CreateLinuxUserStep) Name() string { return "CreateLinuxUser" }

func (s *CreateLinuxUserStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	shell := "/usr/sbin/nologin"
	if plan.ShellAccess {
		shell = "/bin/bash"
	}

	_ = exec.Command("groupadd", "-f", plan.Username).Run()
	if exec.Command("id", plan.Username).Run() != nil {
		if err := exec.Command("useradd", "-m", "-d", plan.HomeDir, "-s", shell, "-g", plan.Username, plan.Username).Run(); err != nil {
			return fmt.Errorf("useradd failed: %w", err)
		}
		s.created = true
	}

	if plan.Password != "" {
		cmd := exec.Command("chpasswd")
		cmd.Stdin = strings.NewReader(fmt.Sprintf("%s:%s\n", plan.Username, plan.Password))
		_ = cmd.Run()
	}

	// Harden /home — no listing of other users
	_ = exec.Command("chmod", "711", paths.UserHomes).Run()

	limits := fmt.Sprintf("%s soft nproc %d\n%s hard nproc %d\n%s soft nofile %d\n%s hard nofile %d\n",
		plan.Username, plan.ProcessLimit, plan.Username, plan.ProcessLimit*2,
		plan.Username, plan.OpenFilesLimit, plan.Username, plan.OpenFilesLimit*2)
	_ = os.WriteFile(fmt.Sprintf("/etc/security/limits.d/%s.conf", plan.Username), []byte(limits), 0644)

	progressLog(plan, s.Name(), 18, fmt.Sprintf("Linux user %s created", plan.Username))
	return nil
}

func (s *CreateLinuxUserStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	if s.created {
		_ = exec.Command("userdel", "-r", plan.Username).Run()
	}
	return nil
}

// ── 4. CreateUserDirectories ──────────────────────────────────────────────────

type CreateUserDirectoriesStep struct{}

func (s *CreateUserDirectoriesStep) Name() string { return "CreateDirectories" }

func (s *CreateUserDirectoriesStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	dirs := []string{
		plan.RootPath,
		filepath.Join(plan.HomeDir, "logs"),
		filepath.Join(plan.HomeDir, "ssl"),
		filepath.Join(plan.HomeDir, "backups"),
		filepath.Join(plan.HomeDir, "tmp"),
		filepath.Join(plan.HomeDir, "mail"),
		filepath.Join(plan.HomeDir, "domains"),
	}
	for _, d := range dirs {
		_ = os.MkdirAll(d, 0755)
	}

	indexFile := filepath.Join(plan.RootPath, "index.html")
	if _, err := os.Stat(indexFile); os.IsNotExist(err) {
		html := fmt.Sprintf(`<!DOCTYPE html><html><head><title>%s</title></head><body><h1>%s is Live</h1><p>User: %s</p></body></html>`,
			plan.MainDomain, plan.MainDomain, plan.Username)
		_ = os.WriteFile(indexFile, []byte(html), 0644)
	}

	_ = exec.Command("chown", "-R", fmt.Sprintf("%s:%s", plan.Username, plan.Username), plan.HomeDir).Run()
	_ = exec.Command("chmod", "711", plan.HomeDir).Run()
	_ = exec.Command("chmod", "755", plan.RootPath).Run()
	_ = services.ChrootHome(plan.Username)

	progressLog(plan, s.Name(), 25, fmt.Sprintf("Directories created at %s", plan.RootPath))
	return nil
}

func (s *CreateUserDirectoriesStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	_ = os.RemoveAll(plan.HomeDir)
	return nil
}

// ── 5. CreatePHPFMPPool ───────────────────────────────────────────────────────

type CreatePHPFMPPoolStep struct {
	poolFile string
}

func (s *CreatePHPFMPPoolStep) Name() string { return "CreatePHPFMPPool" }

func (s *CreatePHPFMPPoolStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	ver := plan.PHPVersion
	s.poolFile = fmt.Sprintf("/etc/php/%s/fpm/pool.d/%s.conf", ver, plan.Username)
	sock := paths.PHPSocketForUser(ver, plan.Username)

	pool := fmt.Sprintf(`[%s]
user = %s
group = %s
listen = %s
listen.owner = www-data
listen.group = www-data
listen.mode = 0660
pm = ondemand
pm.max_children = 5
pm.process_idle_timeout = 10s
chdir = /
php_admin_value[open_basedir] = %s/:/tmp/
php_admin_value[disable_functions] = exec,passthru,shell_exec,system,proc_open,popen
`, plan.Username, plan.Username, plan.Username, sock, plan.HomeDir)

	_ = os.MkdirAll(filepath.Dir(s.poolFile), 0755)
	if err := os.WriteFile(s.poolFile, []byte(pool), 0644); err != nil {
		return err
	}
	_ = exec.Command("service", fmt.Sprintf("php%s-fpm", ver), "reload").Run()
	progressLog(plan, s.Name(), 32, fmt.Sprintf("PHP-FPM pool created (%s)", sock))
	return nil
}

func (s *CreatePHPFMPPoolStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	if s.poolFile != "" {
		_ = os.Remove(s.poolFile)
	}
	return nil
}

// ── 6. CreateDBUsers ──────────────────────────────────────────────────────────

type CreateDBUsersStep struct {
	mysqlDone bool
	pgDone    bool
}

func (s *CreateDBUsersStep) Name() string { return "CreateDBUsers" }

func (s *CreateDBUsersStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	for _, eng := range dbengines.DetectAvailable() {
		if !eng.Available {
			continue
		}
		switch eng.Name {
		case "mysql":
			if err := dbengines.ProvisionMySQLUser(plan.Username, plan.Password); err != nil {
				progressLog(plan, s.Name(), 38, fmt.Sprintf("MySQL user warning: %v", err))
			} else {
				s.mysqlDone = true
				progressLog(plan, s.Name(), 38, "MySQL/MariaDB user provisioned")
			}
			if plan.CreateMySQL {
				dbName := plan.Username + "_db"
				_ = services.ExecMySQL(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4;", dbName))
			}
		case "postgresql":
			if err := dbengines.ProvisionPostgreSQLUser(plan.Username, plan.Password); err != nil {
				progressLog(plan, s.Name(), 40, fmt.Sprintf("PostgreSQL user warning: %v", err))
			} else {
				s.pgDone = true
				progressLog(plan, s.Name(), 40, "PostgreSQL user provisioned")
			}
		}
	}
	return nil
}

func (s *CreateDBUsersStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	if s.mysqlDone {
		dbengines.DropMySQLUser(plan.Username)
	}
	if s.pgDone {
		dbengines.DropPostgreSQLUser(plan.Username)
	}
	return nil
}

// ── 7. CreateFTPAccount ───────────────────────────────────────────────────────

type CreateFTPAccountStep struct{}

func (s *CreateFTPAccountStep) Name() string { return "CreateFTPAccount" }

func (s *CreateFTPAccountStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	ftp := services.GetFTPService()
	if err := ftp.EnsurePrimaryAccount(plan.Username); err != nil {
		progressLog(plan, s.Name(), 45, fmt.Sprintf("FTP warning: %v", err))
		return nil
	}
	progressLog(plan, s.Name(), 45, "Pure-FTPd UnixAuthentication enabled for Linux user")
	return nil
}

func (s *CreateFTPAccountStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	return nil
}

// ── 8. CreateMainVhost ────────────────────────────────────────────────────────

type CreateMainVhostStep struct {
	domain string
}

func (s *CreateMainVhostStep) Name() string { return "CreateMainVhost" }

func (s *CreateMainVhostStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	if plan.MainDomain == "" {
		return nil
	}
	s.domain = plan.MainDomain
	nginx := services.NewNginxService()
	sock := "unix:" + paths.PHPSocketForUser(plan.PHPVersion, plan.Username)
	cfg := services.WebsiteConfig{
		Domain:           plan.MainDomain,
		RootPath:         plan.RootPath,
		ServerEngine:     plan.WebEngine,
		PHPVersion:       plan.PHPVersion,
		SiteType:         "php",
		OwnerUsername:    plan.Username,
		PHPSocket:        sock,
		SkipOwnershipFix: true,
	}
	if err := nginx.CreateWebsite(cfg); err != nil {
		return err
	}
	progressLog(plan, s.Name(), 52, fmt.Sprintf("Vhost created for %s", plan.MainDomain))
	return nil
}

func (s *CreateMainVhostStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	if s.domain != "" {
		_ = services.NewNginxService().DeleteWebsite(s.domain)
	}
	return nil
}

// ── 9. CreateDNSZone ──────────────────────────────────────────────────────────

type CreateUserDNSZoneStep struct {
	domain string
}

func (s *CreateUserDNSZoneStep) Name() string { return "CreateDNSZone" }

func (s *CreateUserDNSZoneStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	if plan.MainDomain == "" {
		return nil
	}
	s.domain = plan.MainDomain
	dns := services.NewDNSService()
	_, err := dns.CreateZone(plan.MainDomain, plan.ServerIP, plan.Username, plan.PackageID)
	if err != nil {
		return err
	}
	progressLog(plan, s.Name(), 58, fmt.Sprintf("DNS zone created for %s", plan.MainDomain))
	return nil
}

func (s *CreateUserDNSZoneStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	if s.domain != "" {
		_ = services.NewDNSService().DeleteZone(s.domain)
	}
	return nil
}

// ── 10. CreateServiceSubdomains ───────────────────────────────────────────────

type CreateServiceSubdomainsStep struct {
	created []string
}

func (s *CreateServiceSubdomainsStep) Name() string { return "CreateServiceSubdomains" }

func (s *CreateServiceSubdomainsStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	if plan.MainDomain == "" {
		return nil
	}
	nginx := services.NewNginxService()
	d := plan.MainDomain

	subs := []struct {
		host string
		fn   func() error
	}{
		{"webmail." + d, func() error {
			return nginx.CreateProxyVhost("webmail."+d, 8086, nil)
		}},
		{"cpanel." + d, func() error {
			return nginx.CreateProxyVhost("cpanel."+d, 2088, map[string]string{"X-Panel-Scope": "client"})
		}},
		{"ftp." + d, func() error {
			return nginx.CreateStaticInfoVhost("ftp."+d, "FTP", "<h1>FTP Server</h1><p>Use FTP client on port 21.</p>")
		}},
		{"imap." + d, func() error {
			return nginx.CreateStaticInfoVhost("imap."+d, "IMAP", "<h1>IMAP Server</h1><p>Connect on port 993 (SSL).</p>")
		}},
		{"pop." + d, func() error {
			return nginx.CreateStaticInfoVhost("pop."+d, "POP3", "<h1>POP3 Server</h1><p>Connect on port 995 (SSL).</p>")
		}},
	}

	for _, sub := range subs {
		if err := sub.fn(); err != nil {
			progressLog(plan, s.Name(), 65, fmt.Sprintf("Subdomain %s warning: %v", sub.host, err))
			continue
		}
		s.created = append(s.created, sub.host)
	}
	progressLog(plan, s.Name(), 65, fmt.Sprintf("Service subdomains provisioned for %s", d))
	return nil
}

func (s *CreateServiceSubdomainsStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	nginx := services.NewNginxService()
	for _, host := range s.created {
		_ = nginx.DeleteWebsite(host)
	}
	return nil
}

// ── 11. IssueWildcardSSL ──────────────────────────────────────────────────────

type IssueWildcardSSLStep struct {
	issued bool
}

func (s *IssueWildcardSSLStep) Name() string { return "IssueWildcardSSL" }

func (s *IssueWildcardSSLStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	if !plan.AutoSSL || plan.MainDomain == "" {
		progressLog(plan, s.Name(), 72, "AutoSSL skipped")
		return nil
	}
	acme := services.NewACMEService()
	status, err := acme.IssueWildcard(plan.MainDomain, plan.RootPath)
	if err != nil {
		progressLog(plan, s.Name(), 72, fmt.Sprintf("SSL warning: %v (self-signed may be used)", err))
		return nil
	}
	s.issued = true
	if facades.Orm() != nil {
		_, _ = facades.Orm().Query().Model(&models.Website{}).Where("domain = ?", plan.MainDomain).Update("ssl_active", true)
	}
	progressLog(plan, s.Name(), 72, fmt.Sprintf("SSL issued: %s", status.Message))
	return nil
}

func (s *IssueWildcardSSLStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	return nil
}

// ── 12. RegenerateVhosts ──────────────────────────────────────────────────────

type RegenerateVhostsStep struct{}

func (s *RegenerateVhostsStep) Name() string { return "RegenerateVhosts" }

func (s *RegenerateVhostsStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	if plan.MainDomain == "" {
		return nil
	}
	nginx := services.NewNginxService()
	sock := "unix:" + paths.PHPSocketForUser(plan.PHPVersion, plan.Username)
	_ = nginx.CreateWebsite(services.WebsiteConfig{
		Domain: plan.MainDomain, RootPath: plan.RootPath, ServerEngine: plan.WebEngine,
		PHPVersion: plan.PHPVersion, SiteType: "php", PHPSocket: sock, SkipOwnershipFix: true,
	})
	_ = nginx.CreateProxyVhost("webmail."+plan.MainDomain, 8086, nil)
	_ = nginx.CreateProxyVhost("cpanel."+plan.MainDomain, 2088, map[string]string{"X-Panel-Scope": "client"})
	progressLog(plan, s.Name(), 78, "Vhosts regenerated with SSL paths")
	return nil
}

func (s *RegenerateVhostsStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	return nil
}

// ── 13. CreateMailbox ─────────────────────────────────────────────────────────

type CreateMailboxStep struct{}

func (s *CreateMailboxStep) Name() string { return "CreateMailbox" }

func (s *CreateMailboxStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	if plan.MainDomain == "" || plan.Email == "" {
		return nil
	}
	email := plan.Email
	if !strings.Contains(email, "@") {
		email = fmt.Sprintf("%s@%s", plan.Username, plan.MainDomain)
	}
	es := services.NewEmailService()
	_ = es.CreateAccount(email, plan.Password, 1024)
	_ = services.GetMailAuthService().SetMailboxPassword(email, plan.Password)
	_ = services.GetMailAuthService().EnsurePostfixVirtualConfig()
	progressLog(plan, s.Name(), 85, fmt.Sprintf("Mailbox created: %s", email))
	return nil
}

func (s *CreateMailboxStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	return nil
}

// ── 14. PersistUserRecord ─────────────────────────────────────────────────────

type PersistUserRecordStep struct{}

func (s *PersistUserRecordStep) Name() string { return "PersistUserRecord" }

func (s *PersistUserRecordStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	passHash := ""
	if facades.Hash() != nil {
		if h, err := facades.Hash().Make(plan.Password); err == nil {
			passHash = h
		}
	}
	if passHash == "" {
		sum := sha256.Sum256([]byte(plan.Password))
		passHash = hex.EncodeToString(sum[:])
	}

	dbCount := 0
	if plan.CreateMySQL {
		dbCount = 1
	}

	plan.ResultUser = &services.UserAccount{
		Username: plan.Username, PasswordHash: passHash, Email: plan.Email,
		MainDomain: plan.MainDomain, IPAddress: plan.ServerIP,
		SetupTime: time.Now().Format("2006-01-02 15:04:05"),
		PackageID: plan.PackageID, PackageName: plan.PackageName,
		IsReseller: plan.IsReseller, Language: plan.Language, HomeDir: plan.HomeDir,
		Status: "active", DiskQuotaMB: 0, AutoSSL: plan.AutoSSL, BackupEnabled: plan.BackupEnabled,
		DomainsCount: 1, DatabasesCount: dbCount, FTPCount: 1, ShellAccess: plan.ShellAccess,
		WebEngine: plan.WebEngine, PHPVersion: plan.PHPVersion,
		MaxProcesses: plan.ProcessLimit, OpenFilesLimit: plan.OpenFilesLimit, InodesLimit: plan.InodeLimit,
		CreatedAt: time.Now().Format("2006-01-02"),
	}

	if err := services.NewUserAccountService().SaveUser(*plan.ResultUser); err != nil {
		return err
	}

	if plan.MainDomain != "" && facades.Orm() != nil {
		engine, _ := domain.NormalizeEngine(plan.WebEngine)
		count, _ := facades.Orm().Query().Model(&models.Website{}).Where("domain = ?", plan.MainDomain).Count()
		if count == 0 {
			_ = facades.Orm().Query().Create(&models.Website{
				Domain: plan.MainDomain, ServerEngine: string(engine), TemplateID: "custom",
				PHPVersion: plan.PHPVersion, SiteType: "php", RootPath: plan.RootPath,
				SSLActive: plan.AutoSSL, OwnerUsername: plan.Username, PackageID: plan.PackageID, Status: "active",
			})
		}
	}

	progressLog(plan, s.Name(), 92, "User record persisted")
	return nil
}

func (s *PersistUserRecordStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	_ = services.NewUserAccountService().DeleteUser(plan.Username)
	return nil
}

// ── 15. VerifyProvision ───────────────────────────────────────────────────────

type VerifyProvisionStep struct{}

func (s *VerifyProvisionStep) Name() string { return "VerifyProvision" }

func (s *VerifyProvisionStep) Execute(ctx context.Context, plan *UserProvisionPlan) error {
	if plan.MainDomain != "" {
		cmd := exec.Command("curl", "-sf", "-H", "Host: "+plan.MainDomain, "http://127.0.0.1/")
		if out, err := cmd.CombinedOutput(); err != nil {
			progressLog(plan, s.Name(), 98, fmt.Sprintf("HTTP verify warning: %v", err))
		} else if !strings.Contains(string(out), plan.MainDomain) && len(out) < 50 {
			progressLog(plan, s.Name(), 98, "HTTP verify: response received")
		} else {
			progressLog(plan, s.Name(), 98, "HTTP verify OK")
		}
	}
	progressLog(plan, s.Name(), 100, "Provisioning complete")
	return nil
}

func (s *VerifyProvisionStep) Rollback(ctx context.Context, plan *UserProvisionPlan) error {
	return nil
}
