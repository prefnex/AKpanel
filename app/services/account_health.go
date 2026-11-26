package services

import (
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"syscall"

	"goravel/app/paths"
)

// AccountIssues lists what is broken between an account's panel record and the system:
// the Linux user it runs as, its home directory and its PHP-FPM pool. An empty list means
// healthy. Typical cause: the record survived a rebuild that lost /etc/passwd, or someone
// ran userdel outside the panel.
func AccountIssues(u UserAccount) []string {
	var issues []string
	lu, err := user.Lookup(u.Username)
	if err != nil {
		issues = append(issues, "Linux user is missing")
	}
	home := u.HomeDir
	if home == "" {
		home = paths.UserHome(u.Username)
	}
	fi, err := os.Stat(home)
	switch {
	case err != nil:
		issues = append(issues, "home directory "+home+" is missing")
	case lu != nil:
		if st, ok := fi.Sys().(*syscall.Stat_t); ok && strconv.Itoa(int(st.Uid)) != lu.Uid {
			issues = append(issues, "home directory is not owned by "+u.Username)
		}
	}
	if v := u.PHPVersion; v != "" && paths.PHPFPMInstalled(v) {
		if _, err := os.Stat(filepath.Join("/etc/php", v, "fpm/pool.d", u.Username+".conf")); err != nil {
			issues = append(issues, fmt.Sprintf("PHP %s pool is missing", v))
		}
	}
	return issues
}
