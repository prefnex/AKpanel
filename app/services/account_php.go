package services

import (
	"fmt"
	"os"
	"strings"

	"github.com/goravel/framework/facades"

	"goravel/app/models"
	"goravel/app/paths"
)

// ApplyAccountPHPVersion is the one way an account changes PHP version. It moves every piece
// that depends on the version together, so nothing is left on the old one:
// users.json → FPM pool (old pools removed) → every vhost the account owns → websites table →
// the `php` its SSH jail runs.
func ApplyAccountPHPVersion(username, version string) (string, error) {
	username = strings.TrimSpace(username)
	version = strings.TrimSpace(version)
	if !IsValidAccountUsername(username) {
		return "", fmt.Errorf("invalid account")
	}
	if !paths.PHPFPMInstalled(version) {
		return "", fmt.Errorf("PHP %s is not installed on this server", version)
	}

	users := NewUserAccountService()
	user, err := users.GetUser(username)
	if err != nil || user == nil {
		return "", fmt.Errorf("account %q not found", username)
	}

	maxChildren, ramMB := 5, user.RAMLimitMB
	if user.PackageID != "" {
		if pkg, err := NewPackagesService().GetPackage(user.PackageID); err == nil && pkg != nil {
			maxChildren, ramMB = pkg.EffectiveMaxPHPChildren(), pkg.EffectiveRAMLimitMB()
		}
	}
	home := strings.TrimSpace(user.HomeDir)
	if home == "" {
		home = paths.UserHome(username)
	}

	// Pool first: the new socket must exist before vhosts point at it.
	if err := NewPHPManagerService().WriteUserFPMPool(username, version, home, maxChildren, ramMB); err != nil {
		return "", err
	}

	user.PHPVersion = version
	if err := users.SaveUser(*user); err != nil {
		return "", err
	}

	if err := rebuildAccountVhosts(user); err != nil {
		return version, err
	}
	WriteAccountCLIVersion(username, version)
	return version, nil
}

// rebuildAccountVhosts regenerates nginx/apache vhosts for every site the account owns so
// they pass PHP to the account's pool on its current version.
func rebuildAccountVhosts(user *UserAccount) error {
	sites, _ := GetClientService().GetWebsites(user.Username)
	nginx := NewNginxService()
	sock := "unix:" + paths.PHPSocketForUser(user.PHPVersion, user.Username)
	defaultEngine := user.WebEngine

	var firstErr error
	for _, site := range sites {
		if site.Domain == "" || site.DocumentRoot == "" {
			continue
		}
		engine, siteType, templateID := defaultEngine, "php", "custom"
		var row models.Website
		haveRow := facades.Orm() != nil &&
			facades.Orm().Query().Where("domain = ?", site.Domain).First(&row) == nil && row.ID != 0
		if haveRow {
			if row.ServerEngine != "" {
				engine = row.ServerEngine
			}
			if row.SiteType != "" {
				siteType = row.SiteType
			}
			if row.TemplateID != "" {
				templateID = row.TemplateID
			}
		}
		if _, err := os.Stat(site.DocumentRoot); err != nil {
			continue
		}
		err := nginx.CreateWebsite(WebsiteConfig{
			Domain:           site.Domain,
			RootPath:         site.DocumentRoot,
			ServerEngine:     engine,
			PHPVersion:       user.PHPVersion,
			PHPSocket:        sock,
			OwnerUsername:    user.Username,
			SiteType:         siteType,
			TemplateID:       templateID,
			SkipOwnershipFix: true,
		})
		if err != nil {
			if firstErr == nil {
				firstErr = fmt.Errorf("%s: %w", site.Domain, err)
			}
			continue
		}
		if haveRow {
			_, _ = facades.Orm().Query().Model(&models.Website{}).Where("domain = ?", site.Domain).
				Update("php_version", user.PHPVersion)
		}
	}
	return firstErr
}

// WriteAccountCLIVersion records the version the account's jailed `php` wrapper runs.
func WriteAccountCLIVersion(username, version string) {
	if !IsValidAccountUsername(username) || !paths.IsPHPVersionString(version) {
		return
	}
	_ = os.MkdirAll(paths.PHPAccountCLIDir, 0755)
	_ = os.WriteFile(paths.AccountCLIVersionFile(username), []byte(version+"\n"), 0644)
}

// RemoveAccountCLIVersion drops the account's jailed `php` version marker.
func RemoveAccountCLIVersion(username string) {
	if !IsValidAccountUsername(username) {
		return
	}
	_ = os.Remove(paths.AccountCLIVersionFile(username))
}

// SyncAccountCLIVersions writes the jailed `php` version marker for every account
// (backfills accounts created before markers existed).
func SyncAccountCLIVersions() {
	for _, u := range NewUserAccountService().ListUsers() {
		WriteAccountCLIVersion(u.Username, paths.DetectInstalledPHPVersion(u.PHPVersion))
	}
}
