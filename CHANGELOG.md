# Changelog

All notable changes to AKpanel are listed here. Versions follow [Semantic Versioning](https://semver.org/).

## [v0.2.0] - 2026-11-26

A large release: a new web-server engine with five real modes, a CWP-style vhost template
library, a rebuilt UI, and a full security pass. Install on a clean VPS; there is no in-place
upgrade path from v0.1.0 yet.

### Web servers
- **Five real modes**: `apache`, `nginx`, `nginx_apache`, `nginx_varnish`, `nginx_varnish_apache`.
  Older profile IDs are converted automatically. "Apache only" now really serves 80/443 with TLS.
- **One orchestrator** (`WebStackService`) is the only writer of nginx, Apache and Varnish
  config. Every change is rendered, tested (`nginx -t`, `apache2ctl configtest`, `varnishd -C`),
  reloaded in order, and every file is rolled back if any test or reload fails.
- **Per-domain stack**: each site can pick its backend, PHP handler (PHP-FPM or PHP-CGI with
  suexec) and Varnish, within what the server mode allows.
- **Varnish in the request path**: nginx → Varnish (127.0.0.1:6081) → Apache or nginx origin;
  Varnish no longer listens on 0.0.0.0.
- **Proxy sites**: a domain can proxy to any IP or hostname and port (IPv6 supported).
- **Service subdomains per domain**: `webmail.`, `mail.`, `cpanel.` and `ftp.` are generated for
  every domain (addon and root sites included) and covered by the domain's certificate.
- **Subdomains**: create and delete subdomains under any domain with a custom document root,
  the parent's owner, stack and PHP version, an automatic DNS record and optional AutoSSL.
- **Vhost template library**: 23 built-in templates. Features: force-https, hsts, http2,
  security-headers, cors, block-malicious, timeouts, large uploads, wildcard, noindex, suspend.
  Apps: WordPress (and multisite), Laravel, Symfony, Drupal, Joomla, Magento 2, PrestaShop, SPA.
  You can also create custom templates; editing one rebuilds every domain that uses it and
  rolls back if the test fails.
- **Main Conf**: default templates for new domains (separately for account domains) and
  server-wide PHP-FPM pool settings, with "apply to existing".
- **Base templates**: nginx, Apache, Varnish and PHP-FPM pool templates can be overridden from
  the panel; each pool is checked with `php-fpm -t` before it is kept.
- **Conf editor**: browse and edit `/etc/nginx`, `/etc/apache2`, `/etc/varnish` and
  `/etc/php/*/fpm`. Each save is tested and reloaded, and the old file comes back on failure.
- **System redirects**: `/cpanel`, `/whm`, `/webmail`, `/phpmyadmin` and similar short paths on
  every domain, editable from the panel.
- **Real status page**: versions, listening addresses and processes for every web daemon, plus
  Apache's MPM, modules and live mod_status (the old page showed fixed numbers).
- Per-domain custom directives that survive rebuilds.

### PHP
- One source for the default PHP version (no more hard-coded 8.2/8.3), with separate defaults
  for Nginx/CLI and Apache.
- Per-account PHP version switches the pool, vhosts, database row and the SSH-jail `php` at once.
- Apache sites now run on the account's own pool instead of the shared www-data pool.

### SSL
- Certificate list reads the real SANs from each certificate and shows which service
  subdomains are covered, and who owns the domain.

### Accounts
- Account health check (Linux user, home folder, PHP pool) with a one-click **Repair**.
- Deleting an account now removes its vhosts, service subdomains, DNS zones, mailboxes, PHP-FPM
  pools, databases, MySQL users, FTP accounts and cron jobs. A leftover pool used to stop PHP-FPM
  for every site on that version.

### Security
- Per-server JWT secret with admin/client scopes, expiry and revocation; bcrypt root password.
- Login rate limiting, CSRF origin checks, CSP and HSTS headers, HTTPS-only panel.
- The tenant file manager runs as the tenant (fsuid/fsgid, `O_NOFOLLOW`).
- Fixed SSRF in remote download, argument injection in git clone, and SQL injection in
  database management.
- Cron jobs actually run now (`/etc/cron.d`, as the tenant).
- The web-service control endpoint only accepts web units.

### Interface
- New UI on shadcn/ui and Motion with light and dark themes, a command palette (Ctrl+K) and a
  mobile drawer for both the admin and client portals.
- New dashboard, Websites and New website screens, and pages for everything above.
- About 8k lines of dead legacy components removed.

### Fixes
- The first request after a save no longer gets the old nginx config (the reload now waits for
  the new workers).
- Changing Apache's `Listen` restarts Apache instead of reloading it, which used to crash it.
- `a2enmod` runs before the Apache config test; a failed provisioning step is rolled back.

## [v0.1.0]

First public release.
