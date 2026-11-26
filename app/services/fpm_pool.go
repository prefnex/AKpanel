package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"goravel/app/paths"
	"goravel/app/templates"
)

// Per-account PHP-FPM pools are rendered from templates/php-fpm/pool.conf.tmpl with the
// Main Conf pool settings (FPMPoolDefaults) and the account's package limits.

// FPMPoolDefaults is the Main Conf pool profile applied to every account pool.
type FPMPoolDefaults struct {
	PM             string `json:"pm"`              // ondemand | dynamic | static
	IdleTimeout    int    `json:"idle_timeout"`    // seconds (ondemand)
	MaxRequests    int    `json:"max_requests"`    // recycle a worker after N requests (0 = never)
	RequestTimeout int    `json:"request_timeout"` // request_terminate_timeout seconds (0 = off)
}

// Normalized fills in defaults and clamps values.
func (d FPMPoolDefaults) Normalized() FPMPoolDefaults {
	switch d.PM {
	case "ondemand", "dynamic", "static":
	default:
		d.PM = "ondemand"
	}
	if d.IdleTimeout <= 0 {
		d.IdleTimeout = 10
	}
	if d.MaxRequests < 0 {
		d.MaxRequests = 0
	}
	if d.RequestTimeout < 0 {
		d.RequestTimeout = 0
	}
	return d
}

// Validate rejects values an admin could not have meant.
func (d FPMPoolDefaults) Validate() error {
	switch d.PM {
	case "", "ondemand", "dynamic", "static":
	default:
		return fmt.Errorf("pm must be ondemand, dynamic or static")
	}
	if d.IdleTimeout < 0 || d.IdleTimeout > 3600 {
		return fmt.Errorf("idle timeout must be 0-3600 seconds")
	}
	if d.MaxRequests < 0 || d.MaxRequests > 1000000 {
		return fmt.Errorf("max requests must be 0-1000000")
	}
	if d.RequestTimeout < 0 || d.RequestTimeout > 86400 {
		return fmt.Errorf("request timeout must be 0-86400 seconds")
	}
	return nil
}

type poolView struct {
	Username, Socket, HomeDir, PM, Version           string
	MaxChildren, MemoryMB, IdleTimeout, MaxRequests  int
	RequestTimeout, StartServers, MinSpare, MaxSpare int
}

// RenderUserFPMPool renders one account's pool file.
func RenderUserFPMPool(username, version, homeDir string, maxChildren, ramMB int, d FPMPoolDefaults) (string, error) {
	d = d.Normalized()
	if maxChildren <= 0 {
		maxChildren = 5
	}
	minSpare := maxChildren / 4
	if minSpare < 1 {
		minSpare = 1
	}
	maxSpare := maxChildren / 2
	if maxSpare < minSpare {
		maxSpare = minSpare
	}
	v := poolView{
		Username: username, Socket: paths.PHPSocketForUser(version, username), HomeDir: strings.TrimRight(homeDir, "/"),
		PM: d.PM, Version: version, MaxChildren: maxChildren, MemoryMB: ramMB, IdleTimeout: d.IdleTimeout,
		MaxRequests: d.MaxRequests, RequestTimeout: d.RequestTimeout,
		StartServers: minSpare, MinSpare: minSpare, MaxSpare: maxSpare,
	}
	return templates.Render("php-fpm", "pool.conf.tmpl", v)
}

func fpmBinary(version string) string {
	for _, p := range []string{"/usr/sbin/php-fpm" + version, "/usr/sbin/php" + version + "-fpm"} {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

// testFPM runs php-fpm -t for one version (skipped when the binary is missing).
func testFPM(version string) error {
	bin := fpmBinary(version)
	if bin == "" {
		return nil
	}
	if out, err := exec.Command(bin, "-t").CombinedOutput(); err != nil {
		return fmt.Errorf("php-fpm %s config test failed: %s", version, lastLines(string(out), 6))
	}
	return nil
}

// writePoolTested writes a pool file and keeps it only if php-fpm -t accepts it.
func writePoolTested(poolFile, version, content string) error {
	_ = os.MkdirAll(filepath.Dir(poolFile), 0755)
	prev, readErr := os.ReadFile(poolFile)
	if err := os.WriteFile(poolFile, []byte(content), 0644); err != nil {
		return err
	}
	if err := testFPM(version); err != nil {
		if readErr == nil { // it existed: put the old one back
			_ = os.WriteFile(poolFile, prev, 0644)
		} else {
			_ = os.Remove(poolFile)
		}
		return err
	}
	return nil
}

// RewriteAllPools re-renders every account pool with the current template and Main Conf
// settings. All pools of a PHP version are tested together; if a version fails, its files
// are restored and the error is returned (the other versions keep their new pools).
func RewriteAllPools() (int, error) {
	defs := LoadWebServerDefaults().FPM
	type change struct{ file, prev string }
	byVersion := map[string][]change{}
	count := 0
	for _, u := range NewUserAccountService().ListUsers() {
		if !IsValidAccountUsername(u.Username) {
			continue
		}
		matches, _ := filepath.Glob(fmt.Sprintf("/etc/php/*/fpm/pool.d/%s.conf", u.Username))
		if len(matches) == 0 {
			continue
		}
		poolFile := matches[0]
		version := filepath.Base(filepath.Dir(filepath.Dir(filepath.Dir(poolFile))))
		maxChildren, ramMB := 5, u.RAMLimitMB
		if u.PackageID != "" {
			if pkg, err := NewPackagesService().GetPackage(u.PackageID); err == nil && pkg != nil {
				maxChildren, ramMB = pkg.EffectiveMaxPHPChildren(), pkg.EffectiveRAMLimitMB()
			}
		}
		if ramMB <= 0 {
			ramMB = 256
		}
		home := strings.TrimSpace(u.HomeDir)
		if home == "" {
			home = paths.UserHome(u.Username)
		}
		content, err := RenderUserFPMPool(u.Username, version, home, maxChildren, ramMB, defs)
		if err != nil {
			return count, err
		}
		prev, _ := os.ReadFile(poolFile)
		if string(prev) == content {
			continue
		}
		if err := os.WriteFile(poolFile, []byte(content), 0644); err != nil {
			return count, err
		}
		byVersion[version] = append(byVersion[version], change{poolFile, string(prev)})
		count++
	}
	var firstErr error
	php := NewPHPManagerService()
	for version, changes := range byVersion {
		if err := testFPM(version); err != nil {
			for _, c := range changes {
				_ = os.WriteFile(c.file, []byte(c.prev), 0644)
			}
			count -= len(changes)
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		if err := php.RestartFPM(version); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("php%s-fpm restart failed: %w", version, err)
		}
	}
	return count, firstErr
}
