package services

import (
	"os"
	"path/filepath"
	"regexp"

	"goravel/app/paths"
)

var (
	// New accounts: short, lowercase, alphanumeric (safe for Linux, MySQL prefixes and paths).
	accountUsernameRe = regexp.MustCompile(`^[a-z][a-z0-9]{2,15}$`)
	// Existing accounts created by older releases: any Linux-safe name.
	legacyUsernameRe = regexp.MustCompile(`^[a-z_][a-z0-9_-]{0,31}$`)
)

// reservedAccountNames can never be hosting accounts: they are system users or carry
// special meaning inside the panel.
var reservedAccountNames = map[string]bool{
	"root": true, "admin": true, "administrator": true, "akpanel": true, "daemon": true,
	"bin": true, "sys": true, "sync": true, "games": true, "man": true, "lp": true,
	"mail": true, "news": true, "uucp": true, "proxy": true, "backup": true, "list": true,
	"irc": true, "gnats": true, "nobody": true, "postfix": true, "dovecot": true,
	"dovenull": true, "vmail": true, "mysql": true, "postgres": true, "redis": true,
	"bind": true, "named": true, "nginx": true, "apache": true, "varnish": true,
	"opendkim": true, "debian": true, "ubuntu": true, "ftp": true, "pureftpd": true,
	"phpmyadmin": true, "roundcube": true, "webmail": true, "cpanel": true, "whm": true,
	"systemd": true, "messagebus": true, "syslog": true, "sshd": true,
}

// IsValidNewAccountUsername enforces the username shape required for new hosting accounts.
func IsValidNewAccountUsername(username string) bool {
	return accountUsernameRe.MatchString(username) && !reservedAccountNames[username]
}

// IsValidAccountUsername accepts any existing hosting account name that is Linux-safe and not reserved.
func IsValidAccountUsername(username string) bool {
	return legacyUsernameRe.MatchString(username) && !reservedAccountNames[username]
}

var sensitivePanelFiles = []string{
	"root.auth", "jwt.secret", "users.json", "emails.json", "client_databases.json",
	"ftp_users.json", "client_cron.json", "akpanel.env",
}

// HardenPanelFilePermissions tightens modes on credential-bearing files that older
// releases wrote world-readable.
func HardenPanelFilePermissions() {
	for _, name := range sensitivePanelFiles {
		p := filepath.Join(paths.EtcAKpanel, name)
		if _, err := os.Stat(p); err == nil {
			_ = os.Chmod(p, 0600)
		}
	}
	_ = os.Chmod(paths.EtcAKpanelSecrets, 0700)
	entries, _ := os.ReadDir(paths.EtcAKpanelSecrets)
	for _, e := range entries {
		if !e.IsDir() {
			_ = os.Chmod(filepath.Join(paths.EtcAKpanelSecrets, e.Name()), 0600)
		}
	}
}
