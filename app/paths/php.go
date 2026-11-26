package paths

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// PHP version policy — the SINGLE source of truth for "which PHP".
//
//   - A version is usable for websites only when its FPM binary is installed.
//   - Two server defaults, like the web server modes need: one for sites whose PHP runs under
//     Nginx (php_default_fpm.conf, also the CLI / panel tools default) and one for sites whose
//     PHP runs under Apache (php_default_apache.conf, falls back to the Nginx one). When a file
//     is missing or points at a removed version, the newest installed FPM wins.
//   - The system `php` CLI is pinned to the same default (php_default_cli.conf records it).
//   - Each client account runs one PHP version (users.json php_version): its FPM pool, every
//     vhost it owns, and the `php` it gets in the SSH jail all follow that value.
const (
	PHPDefaultFPMConf = "/etc/akpanel/php_default_fpm.conf"
	PHPDefaultCLIConf = "/etc/akpanel/php_default_cli.conf"
	// PHPDefaultApacheConf is the default version for sites whose PHP runs under Apache.
	PHPDefaultApacheConf = "/etc/akpanel/php_default_apache.conf"
	// PHPAccountCLIDir holds one root-owned file per account with the PHP version its jailed
	// shell runs as `php`. Root-owned so the account cannot point it at another binary.
	PHPAccountCLIDir = "/etc/akpanel/php-cli"
)

var phpVersionRe = regexp.MustCompile(`^[5-9]\.[0-9]$`)

// IsPHPVersionString reports whether v looks like "8.3" (guards paths built from user input).
func IsPHPVersionString(v string) bool {
	return phpVersionRe.MatchString(v)
}

// PHPFPMInstalled reports whether the FPM binary for version is present.
func PHPFPMInstalled(version string) bool {
	if !IsPHPVersionString(version) {
		return false
	}
	_, err := os.Stat(fmt.Sprintf("/usr/sbin/php-fpm%s", version))
	return err == nil
}

// PHPCLIInstalled reports whether /usr/bin/php<version> is present.
func PHPCLIInstalled(version string) bool {
	if !IsPHPVersionString(version) {
		return false
	}
	_, err := os.Stat(fmt.Sprintf("/usr/bin/php%s", version))
	return err == nil
}

// InstalledPHPVersions returns every version with an installed FPM, newest first.
func InstalledPHPVersions() []string {
	matches, _ := filepath.Glob("/usr/sbin/php-fpm*")
	var out []string
	for _, m := range matches {
		v := strings.TrimPrefix(filepath.Base(m), "php-fpm")
		if IsPHPVersionString(v) {
			out = append(out, v)
		}
	}
	sortPHPVersionsDesc(out)
	return out
}

func sortPHPVersionsDesc(vs []string) {
	key := func(v string) int {
		parts := strings.SplitN(v, ".", 2)
		major, _ := strconv.Atoi(parts[0])
		minor := 0
		if len(parts) == 2 {
			minor, _ = strconv.Atoi(parts[1])
		}
		return major*100 + minor
	}
	sort.Slice(vs, func(i, j int) bool { return key(vs[i]) > key(vs[j]) })
}

func readVersionFile(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

// DefaultPHPVersion is the server-wide PHP version for new sites, accounts, panel tools
// (Roundcube, phpMyAdmin) and the system CLI.
func DefaultPHPVersion() string {
	if v := readVersionFile(PHPDefaultFPMConf); PHPFPMInstalled(v) {
		return v
	}
	if installed := InstalledPHPVersions(); len(installed) > 0 {
		return installed[0]
	}
	if v := readVersionFile(PHPDefaultFPMConf); IsPHPVersionString(v) {
		return v
	}
	return "8.3"
}

// DefaultApachePHPVersion is the default for sites whose PHP runs under Apache.
func DefaultApachePHPVersion() string {
	if v := readVersionFile(PHPDefaultApacheConf); PHPFPMInstalled(v) {
		return v
	}
	return DefaultPHPVersion()
}

// DefaultPHPVersionFor picks the server default for a PHP backend ("apache" or "nginx").
func DefaultPHPVersionFor(backend string) string {
	if backend == "apache" {
		return DefaultApachePHPVersion()
	}
	return DefaultPHPVersion()
}

// DetectInstalledPHPVersion returns preferred when its FPM is installed, else the server default.
// Use it wherever a requested/stored version is turned into something that will actually run.
func DetectInstalledPHPVersion(preferred string) string {
	preferred = strings.TrimSpace(preferred)
	if PHPFPMInstalled(preferred) {
		return preferred
	}
	return DefaultPHPVersion()
}

// PHPSocket returns the shared (www-data) FPM socket for a version.
func PHPSocket(version string) string {
	if !IsPHPVersionString(version) {
		version = DefaultPHPVersion()
	}
	return filepath.Join(PHPSocketDir, fmt.Sprintf("php%s-fpm.sock", version))
}

// PHPSocketForUser returns the per-account FPM socket path.
func PHPSocketForUser(version, username string) string {
	if !IsPHPVersionString(version) {
		version = DefaultPHPVersion()
	}
	return filepath.Join(PHPSocketDir, fmt.Sprintf("php%s-fpm-%s.sock", version, username))
}

// AccountCLIVersionFile is where the jailed shell reads an account's `php` version.
func AccountCLIVersionFile(username string) string {
	return filepath.Join(PHPAccountCLIDir, username)
}
