package services

import (
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"

	"goravel/app/paths"
)

// Apache "cgi" PHP handler: mod_fcgid starts php-cgi through a small wrapper script, and
// suexec runs that wrapper as the account user (what suPHP used to do, which Ubuntu no
// longer packages). Wrappers live under the suexec docroot /var/www.
const (
	phpCGIRoot     = "/var/www/php-fcgi"
	phpCGISharedID = "_www" // wrapper dir for root/admin sites (run as www-data, no suexec)
)

// cgiHandlerAvailable reports whether the Apache cgi handler can run PHP version.
func cgiHandlerAvailable(version string) bool {
	if !paths.IsPHPVersionString(version) {
		return false
	}
	for _, p := range []string{
		"/usr/lib/apache2/modules/mod_fcgid.so",
		"/usr/lib/apache2/suexec",
		"/usr/bin/php-cgi" + version,
	} {
		if _, err := os.Stat(p); err != nil {
			return false
		}
	}
	return true
}

func phpCGIWrapperPath(owner, version string) string {
	dir := phpCGISharedID
	if isAccountOwner(owner) {
		dir = owner
	}
	return filepath.Join(phpCGIRoot, dir, "php"+version)
}

func isAccountOwner(owner string) bool {
	owner = strings.TrimSpace(owner)
	return owner != "" && owner != "root" && owner != "admin" && IsValidAccountUsername(owner)
}

// EnsurePHPCGIWrapper writes the fcgid wrapper for owner/version with the same limits as the
// account's FPM pool (open_basedir, memory, disabled functions) and the ownership suexec
// demands (file and directory owned by the user, not writable by anyone else).
func EnsurePHPCGIWrapper(owner, version string) (string, error) {
	if !cgiHandlerAvailable(version) {
		return "", fmt.Errorf("php-cgi %s / mod_fcgid / suexec not installed", version)
	}
	path := phpCGIWrapperPath(owner, version)
	dir := filepath.Dir(path)

	args := []string{}
	uid, gid := 0, 0
	if isAccountOwner(owner) {
		u, err := user.Lookup(owner)
		if err != nil {
			return "", fmt.Errorf("account %s has no Linux user: %w", owner, err)
		}
		uid, _ = strconv.Atoi(u.Uid)
		gid, _ = strconv.Atoi(u.Gid)
		home := u.HomeDir
		ramMB := 256
		if acc, err := NewUserAccountService().GetUser(owner); err == nil && acc != nil {
			if acc.HomeDir != "" {
				home = acc.HomeDir
			}
			if acc.RAMLimitMB > 0 {
				ramMB = acc.RAMLimitMB
			}
			if acc.PackageID != "" {
				if pkg, err := NewPackagesService().GetPackage(acc.PackageID); err == nil && pkg != nil {
					ramMB = pkg.EffectiveRAMLimitMB()
				}
			}
		}
		args = append(args,
			"-d", fmt.Sprintf("open_basedir=%s/:/tmp/", strings.TrimRight(home, "/")),
			"-d", fmt.Sprintf("memory_limit=%dM", ramMB),
			"-d", "disable_functions=exec,passthru,shell_exec,system,proc_open,popen",
		)
	}

	script := fmt.Sprintf(`#!/bin/sh
# Managed by AKpanel — php-cgi %s wrapper for %s (Apache mod_fcgid + suexec).
PHPRC=/etc/php/%s/cgi
export PHPRC
PHP_FCGI_MAX_REQUESTS=500
export PHP_FCGI_MAX_REQUESTS
exec /usr/bin/php-cgi%s %s
`, version, ownerLabel(owner), version, version, shellQuoteArgs(args))

	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	if err := os.WriteFile(path, []byte(script), 0755); err != nil {
		return "", err
	}
	_ = os.Chmod(dir, 0755)
	_ = os.Chmod(path, 0755)
	if isAccountOwner(owner) {
		_ = os.Chown(dir, uid, gid)
		_ = os.Chown(path, uid, gid)
	}
	return path, nil
}

// RemovePHPCGIWrappers deletes an account's wrappers (account deletion).
func RemovePHPCGIWrappers(owner string) {
	if isAccountOwner(owner) {
		_ = os.RemoveAll(filepath.Join(phpCGIRoot, owner))
	}
}

// EnsureSuexecDocroot points apache2-suexec-custom at /var/www (where the wrappers live).
func EnsureSuexecDocroot() {
	conf := "/etc/apache2/suexec/www-data"
	if _, err := os.Stat(filepath.Dir(conf)); err != nil {
		return
	}
	_ = os.WriteFile(conf, []byte("/var/www\npublic_html/cgi-bin\n"), 0644)
}

func ownerLabel(owner string) string {
	if isAccountOwner(owner) {
		return owner
	}
	return "www-data"
}

func shellQuoteArgs(args []string) string {
	q := make([]string, len(args))
	for i, a := range args {
		q[i] = "'" + strings.ReplaceAll(a, "'", `'\''`) + "'"
	}
	return strings.Join(q, " ")
}
