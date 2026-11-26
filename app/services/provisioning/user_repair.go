package provisioning

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/paths"
	"goravel/app/services"
)

// RepairAccount rebuilds what an existing account needs on the system from its panel record:
// the Linux user and group, the home directory layout and ownership, the PHP-FPM pool and
// every vhost the account owns. It never deletes or overwrites the account's files, and it
// does not touch databases, mailboxes or DNS, which live outside the Linux account.
//
// The Linux password is not known (the panel keeps only a hash), so the recreated user has
// a locked password: panel login is unaffected, and SSH/FTP need a password reset.
func RepairAccount(ctx context.Context, username string) ([]string, error) {
	u, err := services.NewUserAccountService().GetUser(username)
	if err != nil {
		return nil, err
	}
	var log []string
	logf := func(format string, a ...any) { log = append(log, fmt.Sprintf(format, a...)) }

	home := u.HomeDir
	if home == "" {
		home = paths.UserHome(u.Username)
	}
	version := u.PHPVersion
	if version == "" || !paths.PHPFPMInstalled(version) {
		version = paths.DefaultPHPVersion()
	}
	plan := &UserProvisionPlan{
		Username: u.Username, MainDomain: u.MainDomain, ShellAccess: u.ShellAccess,
		HomeDir: home, PHPVersion: version,
		ProcessLimit: orDefault(u.MaxProcesses, 40), OpenFilesLimit: orDefault(u.OpenFilesLimit, 200),
		RAMLimitMB: orDefault(u.RAMLimitMB, 1024),
	}
	if u.MainDomain != "" {
		plan.RootPath = paths.UserDomainRoot(u.Username, u.MainDomain)
	}

	hadUser := exec.Command("id", u.Username).Run() == nil
	if err := (&CreateLinuxUserStep{}).Execute(ctx, plan); err != nil {
		return log, fmt.Errorf("recreate Linux user: %w", err)
	}
	if hadUser {
		logf("Linux user %s exists; group, limits and SSH jail re-applied", u.Username)
	} else {
		logf("Linux user %s recreated (password locked: reset it for SSH/FTP)", u.Username)
	}

	// Directory layout without CreateUserDirectoriesStep: that one writes a welcome index.php,
	// and a repair must never replace a customer's files.
	for _, d := range []string{"logs", "ssl", "backups", "tmp", "mail", "domains"} {
		_ = os.MkdirAll(filepath.Join(home, d), 0755)
	}
	if plan.RootPath != "" {
		_ = os.MkdirAll(plan.RootPath, 0755)
	}
	_ = exec.Command("chown", "-R", u.Username+":"+u.Username, home).Run()
	_ = exec.Command("chmod", "711", home).Run()
	_ = exec.Command("setfacl", "-m", "u:www-data:--x", home).Run()
	_ = exec.Command("setfacl", "-R", "-m", "u:www-data:r-X", filepath.Join(home, "domains")).Run()
	_ = exec.Command("setfacl", "-d", "-R", "-m", "u:www-data:r-X", filepath.Join(home, "domains")).Run()
	_ = services.ChrootHome(u.Username)
	logf("Home %s: layout checked, ownership set to %s", home, u.Username)

	if paths.PHPFPMInstalled(version) {
		if err := (&CreatePHPFMPPoolStep{}).Execute(ctx, plan); err != nil {
			logf("PHP-FPM pool: %v", err)
		} else {
			logf("PHP %s pool written", version)
		}
	}

	rebuilt := 0
	if facades.Orm() != nil {
		var rows []models.Website
		if err := facades.Orm().Query().Where("owner_username = ?", u.Username).Find(&rows); err == nil {
			for i := range rows {
				if _, err := services.GetWebStack().ApplySite(services.WebsiteConfigFromRow(&rows[i])); err != nil {
					logf("%s: %v", rows[i].Domain, err)
					continue
				}
				rebuilt++
			}
		}
	}
	logf("%d site(s) re-rendered", rebuilt)

	if left := services.AccountIssues(*u); len(left) > 0 {
		return log, fmt.Errorf("still broken: %v", left)
	}
	return log, nil
}

func orDefault(v, def int) int {
	if v > 0 {
		return v
	}
	return def
}
