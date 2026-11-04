package services

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const cronDir = "/etc/cron.d"

var (
	cronFieldRe  = regexp.MustCompile(`^[0-9A-Za-z*/,\-]{1,64}$`)
	cronMacros   = map[string]bool{"@hourly": true, "@daily": true, "@weekly": true, "@monthly": true, "@yearly": true, "@annually": true, "@midnight": true}
	maxCronJobs  = 50
	maxCronBytes = 2048
)

// NormalizeCronSchedule validates a 5-field (or @macro) schedule and returns it in canonical form.
func NormalizeCronSchedule(schedule string) (string, error) {
	fields := strings.Fields(schedule)
	if len(fields) == 1 && cronMacros[strings.ToLower(fields[0])] {
		return strings.ToLower(fields[0]), nil
	}
	if len(fields) != 5 {
		return "", fmt.Errorf("schedule must have exactly 5 fields (minute hour day month weekday)")
	}
	for _, f := range fields {
		if !cronFieldRe.MatchString(f) {
			return "", fmt.Errorf("invalid schedule field %q", f)
		}
	}
	return strings.Join(fields, " "), nil
}

// ValidateCronCommand rejects commands that could break out of their crontab line.
func ValidateCronCommand(command string) error {
	command = strings.TrimSpace(command)
	if command == "" {
		return fmt.Errorf("command is required")
	}
	if len(command) > maxCronBytes {
		return fmt.Errorf("command is too long (max %d characters)", maxCronBytes)
	}
	if strings.ContainsAny(command, "\n\r\x00") {
		return fmt.Errorf("command must be a single line")
	}
	return nil
}

func tenantCronFile(username string) string {
	return filepath.Join(cronDir, "akpanel-"+username)
}

// WriteTenantCrontab renders the tenant's enabled jobs into /etc/cron.d. Each line carries the
// tenant's user field, so cron runs every job with the tenant's privileges, never root's.
func WriteTenantCrontab(username string, jobs []ClientCronItem) error {
	if !IsValidAccountUsername(username) {
		return fmt.Errorf("invalid account name")
	}
	tenant, err := LookupTenant(username)
	if err != nil {
		return err
	}

	var b strings.Builder
	b.WriteString("# Managed by AKpanel for " + username + ". Do not edit; changes are overwritten.\n")
	b.WriteString("SHELL=/bin/sh\nPATH=/usr/local/bin:/usr/bin:/bin\nMAILTO=\"\"\n")
	b.WriteString("HOME=" + tenant.Home + "\n\n")
	count := 0
	for _, j := range jobs {
		if j.Username != username || !j.IsEnabled {
			continue
		}
		schedule, err := NormalizeCronSchedule(j.Schedule)
		if err != nil || ValidateCronCommand(j.Command) != nil {
			continue
		}
		// '%' means "newline" in crontab syntax; escape it so commands like `date +%F` work.
		cmd := strings.ReplaceAll(strings.TrimSpace(j.Command), "%", `\%`)
		fmt.Fprintf(&b, "%s %s %s\n", schedule, username, cmd)
		count++
	}

	path := tenantCronFile(username)
	if count == 0 {
		_ = os.Remove(path)
		return nil
	}
	if err := os.MkdirAll(cronDir, 0755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(b.String()), 0644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// RemoveTenantCrontab stops every scheduled job of a tenant (suspension / deletion).
func RemoveTenantCrontab(username string) {
	if IsValidAccountUsername(username) {
		_ = os.Remove(tenantCronFile(username))
	}
}
