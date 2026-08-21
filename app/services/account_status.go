package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

)

const accountFlagsDir = "/etc/akpanel/account-flags"
const accountStatusWeb = "/var/www/akpanel-status"

// EnsureAccountStatusPage writes the public hold page shown on suspended/over-quota sites.
func EnsureAccountStatusPage() {
	_ = os.MkdirAll(accountFlagsDir, 0755)
	_ = os.MkdirAll(accountStatusWeb, 0755)
	html := `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Account on hold</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; font-family: ui-sans-serif, system-ui, sans-serif;
    background: radial-gradient(1200px 600px at 20% -10%, #312e81 0%, transparent 50%),
                radial-gradient(900px 500px at 110% 10%, #0e7490 0%, transparent 45%), #09090b;
    color:#fafafa; display:flex; align-items:center; justify-content:center; padding:24px; }
  .card { max-width:560px; width:100%; background:#121215; border:1px solid #27272a; border-radius:24px;
    padding:36px 32px; box-shadow: 0 24px 80px rgba(0,0,0,.45); }
  .badge { display:inline-flex; gap:8px; align-items:center; font-size:11px; letter-spacing:.12em;
    text-transform:uppercase; color:#a5b4fc; background:#312e81; border-radius:999px; padding:6px 12px; }
  h1 { margin:18px 0 10px; font-size:28px; letter-spacing:-.03em; }
  p { color:#a1a1aa; line-height:1.6; margin:0 0 12px; }
  .box { margin-top:20px; padding:14px 16px; border-radius:14px; background:#09090b; border:1px solid #27272a; font-size:13px; color:#d4d4d8; }
  a { color:#818cf8; }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">AKpanel · hosting hold</div>
    <h1>This website is temporarily unavailable</h1>
    <p>The hosting account for this domain is suspended, the package has ended, or a resource limit was exceeded.</p>
    <p>If you are the site owner, sign in to your client panel or contact support so we can restore the sites, including every subdomain on this account.</p>
    <div class="box">Need help? Email the administrator who issued this account. Visitors cannot reach application files while the hold is active.</div>
  </div>
</body>
</html>`
	_ = os.WriteFile(filepath.Join(accountStatusWeb, "index.html"), []byte(html), 0644)
}

func accountFlagPath(username string) string {
	return filepath.Join(accountFlagsDir, filepath.Base(username))
}

// SetAccountHold places an nginx/apache runtime flag. No reload required.
func SetAccountHold(username, kind, reason string) error {
	if username == "" || username == "root" || username == "admin" {
		return nil
	}
	EnsureAccountStatusPage()
	body := fmt.Sprintf("kind=%s\nreason=%s\n", kind, strings.ReplaceAll(reason, "\n", " "))
	return os.WriteFile(accountFlagPath(username), []byte(body), 0644)
}

// ClearAccountHold removes the public hold if the account should be live.
func ClearAccountHold(username string) {
	if username == "" {
		return
	}
	_ = os.Remove(accountFlagPath(username))
}

// RefreshAccountHold decides hold vs live from status + disk/package limits.
func RefreshAccountHold(u UserAccount) {
	if u.Username == "" || u.Username == "root" || u.Username == "admin" {
		return
	}
	EnsureAccountStatusPage()
	if strings.EqualFold(u.Status, "suspended") {
		reason := u.SuspendedReason
		if reason == "" {
			reason = "Administrative suspension"
		}
		_ = SetAccountHold(u.Username, "suspended", reason)
		return
	}
	used := diskUsedMB(u.HomeDir)
	if u.DiskQuotaMB > 0 && used >= u.DiskQuotaMB {
		_ = SetAccountHold(u.Username, "quota", fmt.Sprintf("Disk quota exceeded (%d/%d MB)", used, u.DiskQuotaMB))
		return
	}
	if u.BandwidthLimitMB > 0 && u.BandwidthUsedMB >= u.BandwidthLimitMB {
		_ = SetAccountHold(u.Username, "bandwidth", "Monthly bandwidth limit exceeded")
		return
	}
	ClearAccountHold(u.Username)
}

func diskUsedMB(home string) int {
	if home == "" {
		return 0
	}
	out, err := exec.Command("du", "-sm", home).Output()
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(out))
	if len(fields) == 0 {
		return 0
	}
	n, _ := strconv.Atoi(fields[0])
	return n
}

// NginxAccountHoldSnippet is included in client vhosts. File existence is checked at request time.
func NginxAccountHoldSnippet(owner string) string {
	owner = strings.TrimSpace(owner)
	if owner == "" || owner == "root" || owner == "admin" {
		return ""
	}
	return fmt.Sprintf(`    if (-f %s) {
        return 503;
    }
    error_page 503 @akpanel_hold;
    location @akpanel_hold {
        internal;
        root %s;
        rewrite ^ /index.html break;
    }

`, accountFlagPath(owner), accountStatusWeb)
}

// ApacheAccountHoldSnippet blocks Apache backends for the same account flag.
func ApacheAccountHoldSnippet(owner string) string {
	owner = strings.TrimSpace(owner)
	if owner == "" || owner == "root" || owner == "admin" {
		return ""
	}
	return fmt.Sprintf(`    Alias /akpanel-hold %s
    <Directory %s>
        Require all granted
    </Directory>
    RewriteEngine On
    RewriteCond %s -f
    RewriteRule ^ - [R=503,L]
    ErrorDocument 503 /akpanel-hold/index.html

`, accountStatusWeb, accountStatusWeb, accountFlagPath(owner))
}

