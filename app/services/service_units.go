package services

import (
	"os"
	"os/exec"
	"strings"

	"goravel/app/domain"
	"goravel/app/paths"
)

func currentServerProfile() string {
	b, err := os.ReadFile(paths.ServerProfileConf())
	if err != nil {
		return domain.ProfileNginxPHPFPM
	}
	p := strings.TrimSpace(string(b))
	if p == "" {
		return domain.ProfileNginxPHPFPM
	}
	return p
}

func systemdUnitFiles(unit string) []string {
	return []string{
		"/lib/systemd/system/" + unit + ".service",
		"/usr/lib/systemd/system/" + unit + ".service",
		"/etc/systemd/system/" + unit + ".service",
	}
}

func systemdUnitInstalled(unit string) bool {
	for _, p := range systemdUnitFiles(unit) {
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	if _, err := exec.LookPath(unit); err == nil {
		return true
	}
	return false
}

func systemdIsActive(units ...string) bool {
	for _, u := range units {
		if u == "" {
			continue
		}
		if exec.Command("systemctl", "is-active", "--quiet", u).Run() == nil {
			return true
		}
	}
	return false
}

func resolveServiceUnits(name string) []string {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "named", "bind", "bind9":
		return []string{"bind9", "named"}
	case "powerdns", "pdns":
		return []string{"pdns", "pdns-recursor"}
	case "mariadb", "mysql":
		return []string{"mariadb", "mysql"}
	case "redis", "redis-server":
		return []string{"redis-server", "redis"}
	case "postgresql", "postgres":
		return []string{"postgresql", "postgresql@16-main"}
	case "ufw":
		return []string{"ufw"}
	case "sshd", "ssh":
		return []string{"ssh", "sshd"}
	case "cron", "crond":
		return []string{"cron", "crond"}
	default:
		return []string{name}
	}
}

func firstInstalledUnit(units []string) string {
	for _, u := range units {
		if systemdUnitInstalled(u) {
			return u
		}
	}
	if len(units) > 0 {
		return units[0]
	}
	return ""
}

func controlSystemdUnit(name, action string) error {
	units := resolveServiceUnits(name)
	target := firstInstalledUnit(units)
	if target == "" {
		target = name
	}
	if err := exec.Command("systemctl", action, target).Run(); err != nil {
		return exec.Command("service", target, action).Run()
	}
	return nil
}

func disableNow(units ...string) {
	for _, u := range units {
		_ = exec.Command("systemctl", "disable", "--now", u).Run()
		_ = exec.Command("service", u, "stop").Run()
	}
}

func enableNow(units ...string) {
	for _, u := range units {
		if exec.Command("systemctl", "enable", "--now", u).Run() != nil {
			_ = exec.Command("service", u, "start").Run()
		}
	}
}
