package templates

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// Vhost template library (CWP's named vhost templates, done as composable pieces).
//
// A site's vhost is always rendered from nginx/site.conf.tmpl and apache/site.conf.tmpl; the
// library adds named pieces on top, chosen per domain:
//   - "feature" templates (any number): force-https, http2, cors, timeouts, block-malicious …
//   - "app" templates (at most one): wordpress, laravel, magento … replace nginx's
//     `location /` for PHP sites nginx serves itself, and may move the document root.
//
// Snippets are Go templates executed with the site's view ({{.Domain}}, {{.Root}},
// {{.PHPSocket}}, {{.ApachePublic}} …). Built-ins are locked (view / clone); custom ones are
// stored as JSON in LibraryDir and can be edited and deleted.

// LibraryDir holds custom library templates, one <name>.json each.
const LibraryDir = OverrideDir + "/library"

const (
	KindFeature = "feature"
	KindApp     = "app"
)

// VhostTemplate is one named library entry.
type VhostTemplate struct {
	Name        string `json:"name"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Kind        string `json:"kind"` // feature | app
	Builtin     bool   `json:"builtin"`
	// Nginx goes inside the public nginx server block (the one on :80/:443).
	Nginx string `json:"nginx"`
	// NginxLocation (app only) replaces the default `location / { … }` of the PHP origin
	// nginx serves itself (nginx → php-fpm, or nginx behind Varnish).
	NginxLocation string `json:"nginx_location"`
	// Apache goes inside every Apache VirtualHost of the site. Use {{if .ApachePublic}} for
	// rules that only make sense when Apache faces clients (no nginx in front).
	Apache string `json:"apache"`
	// RootSuffix (app only) is appended to the document root, e.g. "/public".
	RootSuffix string `json:"root_suffix"`
	// Settings the main templates read.
	HTTP2     bool `json:"http2"`
	Wildcard  bool `json:"wildcard"`
	Timeout   int  `json:"timeout"`     // seconds; the largest one chosen wins (default 300)
	MaxBodyMB int  `json:"max_body_mb"` // the largest one chosen wins (default 128)
}

var libName = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,47}$`)

const forceHTTPSNginx = `# Redirect plain HTTP to HTTPS (ACME challenges stay on HTTP).
set $akp_to_https 0;
if ($scheme = http) { set $akp_to_https 1; }
if ($request_uri ~ "^/\.well-known/acme-challenge/") { set $akp_to_https 0; }
if ($akp_to_https = 1) { return 301 https://$host$request_uri; }`

const forceHTTPSApache = `{{- if .ApachePublic}}
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
{{- end}}`

func timeoutTpl(minutes int) VhostTemplate {
	return VhostTemplate{
		Name: fmt.Sprintf("timeout-%dm", minutes), Title: fmt.Sprintf("Timeout %d minutes", minutes), Kind: KindFeature,
		Description: fmt.Sprintf("Lets slow scripts, imports and long uploads run for up to %d minutes (proxy, FastCGI and Apache timeouts).", minutes),
		Timeout:     minutes * 60,
	}
}

var builtinLibrary = []VhostTemplate{
	{
		Name: "force-https", Title: "Force HTTPS", Kind: KindFeature,
		Description: "301-redirects every HTTP request to HTTPS. Let's Encrypt challenges keep working over HTTP.",
		Nginx:       forceHTTPSNginx, Apache: forceHTTPSApache,
	},
	{
		Name: "hsts", Title: "HSTS", Kind: KindFeature,
		Description: "Strict-Transport-Security for one year, subdomains included. Use it together with Force HTTPS.",
		Nginx:       `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`,
		Apache: `{{- if .ApachePublic}}
<IfModule mod_headers.c>
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains" "expr=%{HTTPS} == 'on'"
</IfModule>
{{- end}}`,
	},
	{
		Name: "http2", Title: "HTTP/2", Kind: KindFeature,
		Description: "Serves HTTPS over HTTP/2 (nginx, or Apache with mod_http2 when Apache faces clients).",
		HTTP2:       true,
		Apache: `{{- if .ApachePublic}}
<IfModule mod_http2.c>
    Protocols h2 http/1.1
</IfModule>
{{- end}}`,
	},
	{
		Name: "security-headers", Title: "Security headers", Kind: KindFeature,
		Description: "X-Content-Type-Options, X-Frame-Options (same origin), Referrer-Policy and a strict Permissions-Policy.",
		Nginx: `add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;`,
		Apache: `{{- if .ApachePublic}}
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"
</IfModule>
{{- end}}`,
	},
	{
		Name: "cors", Title: "CORS (any origin)", Kind: KindFeature,
		Description: "Allows cross-origin requests from any site and answers preflight OPTIONS requests. For public APIs and font/CDN hosts.",
		Nginx: `add_header Access-Control-Allow-Origin "*" always;
add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
if ($request_method = OPTIONS) { return 204; }`,
		Apache: `{{- if .ApachePublic}}
<IfModule mod_headers.c>
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    Header always set Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With"
</IfModule>
RewriteEngine On
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^ - [R=204,L]
{{- end}}`,
	},
	{
		Name: "block-malicious", Title: "Block malicious requests", Kind: KindFeature,
		Description: "Returns 403 for path traversal, script injection, common SQL injection patterns, dotfile probes and known scanners.",
		Nginx: `if ($request_uri ~* "(\.\./|%2e%2e%2f|<script|%3cscript|union(.*)select|concat\(|base64_(en|de)code|/etc/passwd|/proc/self)") { return 403; }
if ($request_uri ~* "/\.(git|svn|hg|bzr|env|htpasswd|DS_Store)") { return 403; }
if ($http_user_agent ~* "(sqlmap|nikto|wpscan|masscan|zgrab|nmap|acunetix|nessus|dirbuster)") { return 403; }`,
		Apache: `{{- if .ApachePublic}}
RewriteEngine On
RewriteCond %{REQUEST_URI} (\.\./|<script|union.*select|concat\(|base64_(en|de)code|/etc/passwd) [NC,OR]
RewriteCond %{REQUEST_URI} /\.(git|svn|hg|bzr|env|htpasswd) [NC,OR]
RewriteCond %{HTTP_USER_AGENT} (sqlmap|nikto|wpscan|masscan|zgrab|nmap|acunetix|nessus) [NC]
RewriteRule ^ - [F,L]
{{- end}}`,
	},
	timeoutTpl(5), timeoutTpl(30), timeoutTpl(60),
	{
		Name: "large-uploads", Title: "Large uploads (1 GB)", Kind: KindFeature,
		Description: "Raises the request body limit from 128 MB to 1 GB in nginx and Apache. PHP's own upload_max_filesize still applies.",
		MaxBodyMB:   1024,
	},
	{
		Name: "wildcard", Title: "Wildcard subdomains", Kind: KindFeature,
		Description: "Also answers for *.<domain> (subdomains without their own site fall back to this one). Needs a wildcard DNS record and certificate.",
		Wildcard:    true,
	},
	{
		Name: "noindex", Title: "Hide from search engines", Kind: KindFeature,
		Description: "Sends X-Robots-Tag: noindex, nofollow on every response. For staging and development copies.",
		Nginx:       `add_header X-Robots-Tag "noindex, nofollow" always;`,
		Apache: `{{- if .ApachePublic}}
<IfModule mod_headers.c>
    Header always set X-Robots-Tag "noindex, nofollow"
</IfModule>
{{- end}}`,
	},
	{
		Name: "suspend", Title: "Suspended", Kind: KindFeature,
		Description: "Answers every request with 503 \"site suspended\" without touching the files. Certificates still renew.",
		Nginx:       `if ($request_uri !~ "^/\.well-known/acme-challenge/") { return 503 "This site is temporarily suspended.\n"; }`,
		Apache: `{{- if .ApachePublic}}
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
RewriteRule ^ - [R=503,L]
{{- end}}`,
	},

	// ── Applications ──────────────────────────────────────────────────────────
	{
		Name: "wordpress", Title: "WordPress", Kind: KindApp,
		Description: "Pretty permalinks, xmlrpc.php blocked, no PHP from wp-content/uploads, wp-config.php and logs denied.",
		Nginx: `location = /xmlrpc.php { deny all; access_log off; log_not_found off; }
location ~* ^/wp-content/uploads/.*\.(php|phtml|phar)$ { deny all; }
location ~* /(wp-config\.php|readme\.html|license\.txt|debug\.log)$ { deny all; }`,
		NginxLocation: `location / {
    try_files $uri $uri/ /index.php?$args;
}`,
		Apache: `<Files xmlrpc.php>
    Require all denied
</Files>
<Directory {{.Root}}/wp-content/uploads>
    <FilesMatch "\.(php|phtml|phar)$">
        Require all denied
    </FilesMatch>
</Directory>`,
	},
	{
		Name: "wordpress-multisite-subdir", Title: "WordPress Multisite (subdirectories)", Kind: KindApp,
		Description: "WordPress network with sites in /site-name/: rewrites wp-admin, wp-includes and wp-content per site.",
		Nginx: `location = /xmlrpc.php { deny all; access_log off; log_not_found off; }
location ~* ^/wp-content/uploads/.*\.(php|phtml|phar)$ { deny all; }
if (!-e $request_filename) {
    rewrite /wp-admin$ $scheme://$host$request_uri/ permanent;
    rewrite ^(/[^/]+)?(/wp-.*) $2 last;
    rewrite ^(/[^/]+)?(/.*\.php) $2 last;
}`,
		NginxLocation: `location / {
    try_files $uri $uri/ /index.php?$args;
}`,
	},
	{
		Name: "wordpress-multisite-subdomain", Title: "WordPress Multisite (subdomains)", Kind: KindApp,
		Description: "WordPress network with sites on site-name.<domain>: adds *.<domain> and WordPress permalinks.",
		Wildcard:    true,
		Nginx: `location = /xmlrpc.php { deny all; access_log off; log_not_found off; }
location ~* ^/wp-content/uploads/.*\.(php|phtml|phar)$ { deny all; }`,
		NginxLocation: `location / {
    try_files $uri $uri/ /index.php?$args;
}`,
	},
	{
		Name: "laravel", Title: "Laravel", Kind: KindApp,
		Description: "Document root moves to public/ (unless it already ends there); front controller routing; .env and storage denied.",
		RootSuffix:  "/public",
		Nginx:       `location ~ /\.(?!well-known).* { deny all; }`,
		NginxLocation: `location / {
    try_files $uri $uri/ /index.php?$query_string;
}`,
	},
	{
		Name: "symfony", Title: "Symfony", Kind: KindApp,
		Description: "Document root moves to public/; every request that is not a file goes to index.php.",
		RootSuffix:  "/public",
		NginxLocation: `location / {
    try_files $uri /index.php$is_args$args;
}`,
	},
	{
		Name: "drupal", Title: "Drupal", Kind: KindApp,
		Description: "Clean URLs, private files and PHP outside index.php blocked, image styles generated on demand.",
		Nginx: `location ~ ^/sites/.*/private/ { return 403; }
location ~ ^/sites/[^/]+/files/.*\.php$ { deny all; }
location ~* \.(engine|inc|install|make|module|profile|po|sh|.*sql|theme|twig|tpl(\.php)?|xtmpl|yml)(~|\.sw[op]|\.bak|\.orig|\.save)?$ { deny all; }`,
		NginxLocation: `location / {
    try_files $uri /index.php?$query_string;
}`,
	},
	{
		Name: "joomla", Title: "Joomla", Kind: KindApp,
		Description: "Search-engine-friendly URLs; scripts in images/, tmp/ and logs/ blocked.",
		Nginx:       `location ~* ^/(images|tmp|logs|cache)/.*\.(php|pl|py|jsp|asp|sh|cgi)$ { return 403; }`,
		NginxLocation: `location / {
    try_files $uri $uri/ /index.php?$args;
}`,
	},
	{
		Name: "magento2", Title: "Magento 2", Kind: KindApp,
		Description: "Document root moves to pub/; static and media versioned URLs; setup and update tools blocked.",
		RootSuffix:  "/pub",
		Timeout:     600,
		Nginx: `location ~* ^/(setup|update)($|/) { deny all; }
location /static/ {
    location ~ ^/static/version\d*/ { rewrite ^/static/version\d*/(.*)$ /static/$1 last; }
    try_files $uri $uri/ /static.php?resource=$uri&$args;
}
location /media/ {
    try_files $uri $uri/ /get.php$is_args$args;
}`,
		NginxLocation: `location / {
    try_files $uri $uri/ /index.php$is_args$args;
}`,
	},
	{
		Name: "prestashop", Title: "PrestaShop", Kind: KindApp,
		Description: "Friendly URLs, admin folder kept working, config and logs denied.",
		Nginx:       `location ~ /(app|cache|classes|config|log|translations|var|vendor)/.*\.(php|yml|log|twig)$ { deny all; }`,
		NginxLocation: `location / {
    try_files $uri $uri/ /index.php$is_args$args;
}`,
	},
	{
		Name: "spa", Title: "Single-page app", Kind: KindApp,
		Description: "Unknown paths fall back to /index.html (React, Vue, Angular built apps with client-side routing).",
		NginxLocation: `location / {
    try_files $uri $uri/ /index.html;
}`,
	},
}

func builtinByName(name string) (VhostTemplate, bool) {
	for _, t := range builtinLibrary {
		if t.Name == name {
			t.Builtin = true
			return t, true
		}
	}
	return VhostTemplate{}, false
}

func libraryPath(name string) string { return filepath.Join(LibraryDir, name+".json") }

// Library returns every built-in and custom template, built-ins first.
func Library() []VhostTemplate {
	out := make([]VhostTemplate, 0, len(builtinLibrary)+8)
	for _, t := range builtinLibrary {
		t.Builtin = true
		out = append(out, t)
	}
	entries, _ := os.ReadDir(LibraryDir)
	var custom []VhostTemplate
	for _, e := range entries {
		name := strings.TrimSuffix(e.Name(), ".json")
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") || !libName.MatchString(name) {
			continue
		}
		if t, err := readCustom(name); err == nil {
			custom = append(custom, t)
		}
	}
	sort.Slice(custom, func(i, j int) bool { return custom[i].Name < custom[j].Name })
	return append(out, custom...)
}

func readCustom(name string) (VhostTemplate, error) {
	b, err := os.ReadFile(libraryPath(name))
	if err != nil {
		return VhostTemplate{}, err
	}
	var t VhostTemplate
	if err := json.Unmarshal(b, &t); err != nil {
		return VhostTemplate{}, fmt.Errorf("%s: %w", name, err)
	}
	t.Name, t.Builtin = name, false
	return t, nil
}

// LibraryTemplate finds one template by name.
func LibraryTemplate(name string) (VhostTemplate, error) {
	if t, ok := builtinByName(name); ok {
		return t, nil
	}
	if !libName.MatchString(name) {
		return VhostTemplate{}, fmt.Errorf("unknown vhost template %q", name)
	}
	t, err := readCustom(name)
	if err != nil {
		return VhostTemplate{}, fmt.Errorf("unknown vhost template %q", name)
	}
	return t, nil
}

// Validate checks a template's fields and that its snippets parse.
func (t VhostTemplate) Validate() error {
	if !libName.MatchString(t.Name) {
		return fmt.Errorf("name must be 2-48 characters: lowercase letters, digits, - and _")
	}
	if strings.TrimSpace(t.Title) == "" {
		return fmt.Errorf("title is required")
	}
	if t.Kind != KindFeature && t.Kind != KindApp {
		return fmt.Errorf("kind must be %q or %q", KindFeature, KindApp)
	}
	if t.Kind != KindApp && (t.NginxLocation != "" || t.RootSuffix != "") {
		return fmt.Errorf("only app templates can replace location / or move the document root")
	}
	if t.RootSuffix != "" && (!strings.HasPrefix(t.RootSuffix, "/") || strings.Contains(t.RootSuffix, "..") ||
		strings.ContainsAny(t.RootSuffix, " \t\n;{}\"'")) {
		return fmt.Errorf("root suffix must be a plain path like /public")
	}
	if t.Timeout < 0 || t.Timeout > 86400 {
		return fmt.Errorf("timeout must be between 0 and 86400 seconds")
	}
	if t.MaxBodyMB < 0 || t.MaxBodyMB > 102400 {
		return fmt.Errorf("max body must be between 0 and 102400 MB")
	}
	for field, src := range map[string]string{"nginx": t.Nginx, "nginx_location": t.NginxLocation, "apache": t.Apache} {
		if _, err := parse(t.Name+"/"+field, src); err != nil {
			return fmt.Errorf("%s snippet does not parse: %w", field, err)
		}
	}
	return nil
}

// SaveLibraryTemplate creates or replaces a custom template and returns the previous
// version (nil when it is new) so the caller can roll back.
func SaveLibraryTemplate(t VhostTemplate) (*VhostTemplate, error) {
	t.Name = strings.TrimSpace(t.Name)
	if _, ok := builtinByName(t.Name); ok {
		return nil, fmt.Errorf("%q is a built-in template: clone it under another name", t.Name)
	}
	t.Builtin = false
	if err := t.Validate(); err != nil {
		return nil, err
	}
	var prev *VhostTemplate
	if old, err := readCustom(t.Name); err == nil {
		prev = &old
	}
	if err := os.MkdirAll(LibraryDir, 0755); err != nil {
		return nil, err
	}
	b, _ := json.MarshalIndent(t, "", "  ")
	return prev, os.WriteFile(libraryPath(t.Name), b, 0644)
}

// DeleteLibraryTemplate removes a custom template.
func DeleteLibraryTemplate(name string) error {
	if _, ok := builtinByName(name); ok {
		return fmt.Errorf("built-in templates cannot be deleted")
	}
	if !libName.MatchString(name) {
		return fmt.Errorf("unknown vhost template %q", name)
	}
	err := os.Remove(libraryPath(name))
	if os.IsNotExist(err) {
		return fmt.Errorf("unknown vhost template %q", name)
	}
	return err
}

// RestoreLibraryTemplate puts back a previous version (or removes a new one).
func RestoreLibraryTemplate(name string, prev *VhostTemplate) {
	if prev == nil {
		_ = os.Remove(libraryPath(name))
		return
	}
	b, _ := json.MarshalIndent(prev, "", "  ")
	_ = os.WriteFile(libraryPath(name), b, 0644)
}

// RenderSnippet executes one snippet against a site's view.
func RenderSnippet(name, src string, data any) (string, error) {
	if strings.TrimSpace(src) == "" {
		return "", nil
	}
	t, err := parse(name, src)
	if err != nil {
		return "", err
	}
	var sb strings.Builder
	if err := t.Execute(&sb, data); err != nil {
		return "", err
	}
	return strings.TrimSpace(sb.String()), nil
}

// ParseTemplateList reads a stored per-domain choice: "" → defaults, "none" → nothing,
// otherwise a comma list (duplicates dropped, order kept).
func ParseTemplateList(stored string, defaults []string) []string {
	stored = strings.TrimSpace(stored)
	switch stored {
	case "":
		return append([]string(nil), defaults...)
	case "none":
		return nil
	}
	return CleanTemplateList(strings.Split(stored, ","))
}

// CleanTemplateList trims and de-duplicates names.
func CleanTemplateList(names []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, n := range names {
		n = strings.TrimSpace(n)
		if n == "" || seen[n] {
			continue
		}
		seen[n] = true
		out = append(out, n)
	}
	return out
}

// FormatTemplateList is the stored form of an explicit choice.
func FormatTemplateList(names []string) string {
	names = CleanTemplateList(names)
	if len(names) == 0 {
		return "none"
	}
	return strings.Join(names, ",")
}

// ResolveTemplateList loads the named templates and checks they fit together.
func ResolveTemplateList(names []string) ([]VhostTemplate, error) {
	var out []VhostTemplate
	app := ""
	for _, n := range CleanTemplateList(names) {
		t, err := LibraryTemplate(n)
		if err != nil {
			return nil, err
		}
		if t.Kind == KindApp {
			if app != "" {
				return nil, fmt.Errorf("pick one application template, not %s and %s", app, t.Name)
			}
			app = t.Name
		}
		out = append(out, t)
	}
	return out, nil
}
