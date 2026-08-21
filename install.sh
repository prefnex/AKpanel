#!/usr/bin/env bash
# ==============================================================================
#  🚀 AKpanel - Official High-Performance Linux Hosting Panel Installer
# ==============================================================================

set +e

# Default Settings
DEFAULT_REPO="prefnex/AKpanel"
GITHUB_REPO="${AKPANEL_REPO:-$DEFAULT_REPO}"
DEFAULT_VERSION="v0.1.0"
INSTALL_DIR="/opt/akpanel"
LOG_FILE="/var/log/akpanel-install.log"

# Global Variables
VERBOSE=false
REBUILD=false
AUTO_CONFIRM=false

# Parse Arguments
for arg in "$@"; do
    case "$arg" in
        --verbose|-v|--debug)
            VERBOSE=true
            ;;
        --rebuild|--reset)
            REBUILD=true
            ;;
        -y|--yes)
            AUTO_CONFIRM=true
            ;;
        --help|-h)
            echo "AKpanel Installer Usage:"
            echo "  bash install.sh               # Standard animated installation"
            echo "  bash install.sh --verbose     # Full detailed output of all commands"
            echo "  bash install.sh --rebuild     # Complete clean reset and reinstall"
            exit 0
            ;;
    esac
done

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# When the script is piped (curl | bash), plain "read" consumes script lines from stdin
# and breaks if/else structure. Always read interactive answers from the terminal.
akpanel_read() {
    local _prompt="$1"
    local _var="$2"
    if [ -e /dev/tty ]; then
        IFS= read -r -p "$_prompt" "$_var" < /dev/tty
    else
        IFS= read -r -p "$_prompt" "$_var"
    fi
}

# Keep hostnames ASCII-only (strips accidental Arabic keyboard input / RTL junk).
sanitize_fqdn() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:].-' | sed 's/^[.-]*//; s/[.-]*$//'
}

warn_hostname_dns() {
    [ -z "$AKPANEL_HOSTNAME" ] && return 0
    local RESOLVED
    RESOLVED=$(getent ahostsv4 "$AKPANEL_HOSTNAME" 2>/dev/null | awk '{print $1; exit}')
    if [ -z "$RESOLVED" ]; then
        echo -e "${YELLOW}  DNS: ${AKPANEL_HOSTNAME} does not resolve yet (NXDOMAIN).${NC}"
        echo -e "${DIM}  Add an A record pointing to ${SERVER_IP} at your domain registrar.${NC}"
        echo -e "${DIM}  Until DNS propagates, open the panel via IP: https://${SERVER_IP}:2087${NC}\n"
    elif [ "$RESOLVED" != "$SERVER_IP" ]; then
        echo -e "${YELLOW}  DNS: ${AKPANEL_HOSTNAME} -> ${RESOLVED} (this server is ${SERVER_IP}).${NC}\n"
    fi
}

mkdir -p /var/log
echo "=== AKpanel Installation Started: $(date) ===" > "$LOG_FILE"

# Pre-detect Global IP and Architecture (Never empty)
SERVER_IP=$(curl -s --connect-timeout 3 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
[ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"

ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64) PKG_ARCH="amd64" ;;
    aarch64|arm64) PKG_ARCH="arm64" ;;
    *) PKG_ARCH="amd64" ;;
esac

UBUNTU_CODENAME=$(lsb_release -sc 2>/dev/null || grep VERSION_CODENAME /etc/os-release 2>/dev/null | cut -d= -f2 || echo "noble")

# Pre-generate Root Password if not exists
if [ -f /etc/akpanel/credentials.txt ]; then
    ROOT_ADMIN_PASS=$(grep "Generated Pass" /etc/akpanel/credentials.txt 2>/dev/null | awk '{print $NF}' || true)
fi
if [ -z "$ROOT_ADMIN_PASS" ]; then
    if [ -n "$AKPANEL_PASSWORD" ]; then
        ROOT_ADMIN_PASS="$AKPANEL_PASSWORD"
    else
        ROOT_ADMIN_PASS=$(tr -dc 'A-Za-z0-9#$!&@%' < /dev/urandom 2>/dev/null | head -c 16 || true)
        [ -z "$ROOT_ADMIN_PASS" ] && ROOT_ADMIN_PASS="AkPanel@$(date +%s | cut -c5-10)!"
    fi
fi

# Banner
echo -e "${PURPLE}${BOLD}"
cat << "EOF"
    _    _  ______                  _ 
   / \  | |/ /  _ \ __ _ _ __   ___| |
  / _ \ | ' /| |_) / _` | '_ \ / _ \ |
 / ___ \| . \|  __/ (_| | | | |  __/ |
/_/   \_\_|\_\_|   \__,_|_| |_|\___|_|
                                      
  Next-Gen High Performance Cloud Hosting Control Panel
EOF
echo -e "${NC}"

# Check Root Privileges
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}❌ Error: This script must be run as root!${NC}"
    echo "Please re-run using: sudo bash $0"
    exit 1
fi

# Rebuild / Reset Mode Confirmation
if [ "$REBUILD" = true ]; then
    echo -e "${YELLOW}${BOLD}⚠️  WARNING: Full Rebuild Mode Selected!${NC}"
    echo -e "This will stop all AKpanel services, wipe ${INSTALL_DIR}, reset configurations, and perform a 100% clean reinstall."
    if [ "$AUTO_CONFIRM" = false ]; then
        akpanel_read "Are you sure you want to proceed? (y/N): " CONFIRM_REBUILD
        if [[ ! "$CONFIRM_REBUILD" =~ ^[Yy]$ ]]; then
            echo -e "${CYAN}Rebuild cancelled by user.${NC}"
            exit 0
        fi
    fi
    echo -e "${CYAN}🧹 Tearing down existing AKpanel services...${NC}"
    systemctl stop akpanel 2>/dev/null || true
    pkill -9 -f '/usr/local/bin/akpanel' 2>/dev/null || true
    rm -rf "$INSTALL_DIR" /etc/akpanel /usr/local/bin/akpanel
    echo -e "${GREEN}✓ Clean state ready. Proceeding with fresh installation...${NC}\n"
fi

# Optional server identity (all skippable — press Enter to skip)
AKPANEL_HOSTNAME=""
AKPANEL_NS1=""
AKPANEL_NS2=""
AKPANEL_ADMIN_EMAIL=""

if [ "$AUTO_CONFIRM" = false ]; then
    echo -e "\n${CYAN}${BOLD}Optional Server Identity${NC} ${DIM}(press Enter to skip any field)${NC}"
    echo -e "${DIM}If provided, AKpanel configures hostname, nameservers, and issues Hostname SSL (LE → ZeroSSL fallback).${NC}\n"
    akpanel_read "  Panel Hostname (FQDN, e.g. server.akpanel.site): " AKPANEL_HOSTNAME
    akpanel_read "  Primary Nameserver (e.g. ns1.akpanel.site): " AKPANEL_NS1
    akpanel_read "  Secondary Nameserver (e.g. ns2.akpanel.site): " AKPANEL_NS2
    akpanel_read "  Admin Email (for SSL notifications): " AKPANEL_ADMIN_EMAIL
    AKPANEL_HOSTNAME=$(sanitize_fqdn "$AKPANEL_HOSTNAME")
    AKPANEL_NS1=$(sanitize_fqdn "$AKPANEL_NS1")
    AKPANEL_NS2=$(sanitize_fqdn "$AKPANEL_NS2")
    AKPANEL_ADMIN_EMAIL=$(echo "$AKPANEL_ADMIN_EMAIL" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
    warn_hostname_dns
    echo ""
fi

# Web server stack profile (default: nginx + php-fpm)
AKPANEL_WEB_PROFILE="nginx_phpfpm"

# PHP versions — 8.3 always installed as primary
AKPANEL_PHP_VERSIONS="8.3"

if [ "$AUTO_CONFIRM" = false ]; then
    echo -e "${CYAN}${BOLD}Web Server Stack${NC}"
    echo -e "  ${GREEN}1)${NC} Nginx + PHP-FPM ${DIM}(default — fastest)${NC}"
    echo -e "  ${GREEN}2)${NC} Apache + PHP ${DIM}(.htaccess via Apache backend)${NC}"
    echo -e "  ${GREEN}3)${NC} Nginx + Apache Hybrid ${DIM}(static Nginx, dynamic Apache)${NC}"
    echo -e "  ${GREEN}4)${NC} Nginx + Varnish + Apache ${DIM}(cached hybrid)${NC}"
    echo -e "  ${GREEN}5)${NC} Nginx + Varnish + PHP-FPM ${DIM}(cached pure FPM)${NC}"
    akpanel_read "  Choose stack [1-5] (default 1): " WS_CHOICE
    case "${WS_CHOICE:-1}" in
        2) AKPANEL_WEB_PROFILE="apache_phpfpm" ;;
        3) AKPANEL_WEB_PROFILE="hybrid_nginx_apache" ;;
        4) AKPANEL_WEB_PROFILE="varnish_nginx_apache" ;;
        5) AKPANEL_WEB_PROFILE="varnish_nginx_phpfpm" ;;
        *) AKPANEL_WEB_PROFILE="nginx_phpfpm" ;;
    esac
    echo ""

    echo -e "${CYAN}${BOLD}PHP Versions${NC}"
    echo -e "  Primary version ${GREEN}8.3${NC} will always be installed."
    akpanel_read "  Install additional PHP versions? [y/N]: " INSTALL_EXTRA_PHP
    if [[ "$INSTALL_EXTRA_PHP" =~ ^[Yy]$ ]]; then
        echo -e "  Available: ${DIM}7.4  8.0  8.1  8.2  8.4${NC}"
        akpanel_read "  Enter extra versions (space-separated, e.g. 8.1 8.2): " AKPANEL_PHP_EXTRA
        for ver in $AKPANEL_PHP_EXTRA; do
            ver=$(echo "$ver" | tr -d '[:alpha:]' | xargs)
            [ -z "$ver" ] && continue
            [ "$ver" = "8.3" ] && continue
            case " $AKPANEL_PHP_VERSIONS " in
                *" $ver "*) ;;
                *) AKPANEL_PHP_VERSIONS="$AKPANEL_PHP_VERSIONS $ver" ;;
            esac
        done
    fi
    echo -e "  ${DIM}Will install PHP:${NC} ${GREEN}${AKPANEL_PHP_VERSIONS}${NC}\n"
fi

if [ "$VERBOSE" = true ]; then
    echo -e "${YELLOW}🔍 Running in Detailed Verbose Mode (--verbose)... All command outputs visible.${NC}\n"
else
    echo -e "${BOLD}🚀 Starting Clean Automated Installation...${NC} ${DIM}(Logs: ${LOG_FILE} | Run with --verbose for raw logs)${NC}\n"
fi

build_php_package_list() {
    local PKG_LIST=""
    for ver in $AKPANEL_PHP_VERSIONS; do
        PKG_LIST="$PKG_LIST php${ver}-cli php${ver}-fpm php${ver}-common php${ver}-mysql php${ver}-curl php${ver}-mbstring php${ver}-xml php${ver}-zip php${ver}-gd"
    done
    echo "$PKG_LIST"
}

write_install_metadata() {
    mkdir -p /etc/akpanel
    echo "$AKPANEL_WEB_PROFILE" > /etc/akpanel/server_profile.conf

    local PHP_JSON="["
    local first=true
    for ver in $AKPANEL_PHP_VERSIONS; do
        $first || PHP_JSON="${PHP_JSON},"
        first=false
        PHP_JSON="${PHP_JSON}\"${ver}\""
    done
    PHP_JSON="${PHP_JSON}]"

    local VARNISH_ENABLED="false"
    if [ "$AKPANEL_WEB_PROFILE" = "varnish_nginx_apache" ] || [ "$AKPANEL_WEB_PROFILE" = "varnish_nginx_phpfpm" ]; then
        VARNISH_ENABLED="true"
    fi

    cat << EOF > /etc/akpanel/install.conf
{
  "hostname": "${AKPANEL_HOSTNAME:-}",
  "admin_email": "${AKPANEL_ADMIN_EMAIL:-admin@localhost}",
  "panel": {
    "admin_port": 2087,
    "client_port": 2083,
    "admin_username": "root",
    "ssl_enabled": false
  },
  "components": {
    "webserver_profile": "${AKPANEL_WEB_PROFILE}",
    "php_versions": ${PHP_JSON},
    "mariadb": true,
    "postgresql": false,
    "redis": true,
    "bind_dns": true,
    "mail_stack": true,
    "varnish": ${VARNISH_ENABLED}
  },
  "paths": {
    "sites_root": "/var/www/sites",
    "user_homes": "/home"
  }
}
EOF
    chmod 644 /etc/akpanel/install.conf /etc/akpanel/server_profile.conf 2>/dev/null || true
}

# Default nginx site must execute PHP (index.php) via php-fpm immediately
# after install. Distro snippets/fastcgi-php.conf 404s bare /index.php.
configure_nginx_php() {
    mkdir -p /etc/nginx/snippets /etc/nginx/sites-available /etc/nginx/sites-enabled /var/www/html /etc/akpanel/ssl/default

    local sock=""
    local v
    for v in $AKPANEL_PHP_VERSIONS 8.4 8.3 8.2 8.1 8.0; do
        systemctl enable "php${v}-fpm" >> "$LOG_FILE" 2>&1 || true
        service "php${v}-fpm" start >> "$LOG_FILE" 2>&1 || systemctl start "php${v}-fpm" >> "$LOG_FILE" 2>&1 || true
        if [ -S "/run/php/php${v}-fpm.sock" ]; then
            sock="unix:/run/php/php${v}-fpm.sock"
            break
        fi
    done
    if [ -z "$sock" ] && [ -S /run/php/php-fpm.sock ]; then
        sock="unix:/run/php/php-fpm.sock"
    fi
    [ -z "$sock" ] && sock="unix:/run/php/php8.3-fpm.sock"

    if [ ! -f /etc/akpanel/ssl/default/fullchain.pem ] || [ ! -f /etc/akpanel/ssl/default/privkey.pem ]; then
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout /etc/akpanel/ssl/default/privkey.pem \
            -out /etc/akpanel/ssl/default/fullchain.pem \
            -subj "/CN=localhost" >> "$LOG_FILE" 2>&1 || true
        chmod 600 /etc/akpanel/ssl/default/privkey.pem 2>/dev/null || true
    fi

    cat > /etc/nginx/snippets/akpanel-php.conf << 'EOF'
fastcgi_split_path_info ^(.+\.php)(/.*)$;
fastcgi_index index.php;
include fastcgi_params;
fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
fastcgi_param PATH_INFO $fastcgi_path_info;
fastcgi_read_timeout 300;
EOF

    cat > /etc/nginx/sites-available/default << NGINX_EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    root /var/www/html;
    index index.php index.html index.htm;

    ssl_certificate /etc/akpanel/ssl/default/fullchain.pem;
    ssl_certificate_key /etc/akpanel/ssl/default/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \\.php\$ {
        try_files \$uri =404;
        fastcgi_split_path_info ^(.+\\.php)(/.*)\$;
        fastcgi_pass ${sock};
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_param PATH_INFO \$fastcgi_path_info;
        fastcgi_read_timeout 300;
    }

    location ~ /\\.ht {
        deny all;
    }
}
NGINX_EOF

    ln -sfn /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
    rm -f /etc/nginx/sites-enabled/000-default /etc/nginx/sites-enabled/000-default.conf

    if [ ! -f /var/www/html/index.php ]; then
        cat > /var/www/html/index.php << 'EOF'
<?php
header('Content-Type: text/html; charset=UTF-8');
echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>AKpanel</title></head><body>';
echo '<h1>AKpanel default site</h1><p>PHP '.PHP_VERSION.' via php-fpm is ready.</p></body></html>';
EOF
        chmod 644 /var/www/html/index.php
    fi

    nginx -t >> "$LOG_FILE" 2>&1 && (systemctl reload nginx >> "$LOG_FILE" 2>&1 || service nginx reload >> "$LOG_FILE" 2>&1) || true
}

PROGRESS_FILE="/tmp/akpanel-install.progress"

akp_progress() {
    local pct="$1"
    shift
    local msg="$*"
    echo "${pct}|${msg}" > "$PROGRESS_FILE"
}

akp_crawl() {
    local from="$1"
    local to="$2"
    shift 2
    local label="$1"
    shift
    akp_progress "$from" "$label"
    "$@" >> "$LOG_FILE" 2>&1 &
    local pid=$!
    local p=$from
    while kill -0 "$pid" 2>/dev/null; do
        sleep 2
        if [ "$p" -lt $((to - 1)) ]; then
            p=$((p + 1))
            akp_progress "$p" "$label"
        fi
    done
    wait "$pid"
    local st=$?
    akp_progress "$to" "$label"
    return $st
}

svc_disable_now() {
    local u
    for u in "$@"; do
        systemctl disable --now "$u" >> "$LOG_FILE" 2>&1 || service "$u" stop >> "$LOG_FILE" 2>&1 || true
    done
}

svc_enable_now() {
    local u
    for u in "$@"; do
        systemctl enable --now "$u" >> "$LOG_FILE" 2>&1 || service "$u" start >> "$LOG_FILE" 2>&1 || true
    done
}

configure_postfix_submission() {
    local master="/etc/postfix/master.cf"
    [ -f "$master" ] || return 0
    if ! grep -qE '^submission[[:space:]]' "$master"; then
        cat >> "$master" << 'EOF'

submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=may
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_tls_auth_only=no
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_relay_restrictions=permit_sasl_authenticated,reject
smtps     inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/smtps
  -o smtpd_tls_wrappermode=yes
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_reject_unlisted_recipient=no
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject
  -o smtpd_relay_restrictions=permit_sasl_authenticated,reject
EOF
    fi
    postconf -e "inet_interfaces = all" >> "$LOG_FILE" 2>&1 || true
    systemctl reload postfix >> "$LOG_FILE" 2>&1 || service postfix reload >> "$LOG_FILE" 2>&1 || true
}

apply_webserver_profile() {
    case "$AKPANEL_WEB_PROFILE" in
        nginx_phpfpm)
            svc_disable_now apache2 varnish
            svc_enable_now nginx
            ;;
        apache_phpfpm)
            svc_disable_now varnish
            svc_enable_now nginx apache2
            ;;
        hybrid_nginx_apache)
            svc_disable_now varnish
            svc_enable_now nginx apache2
            ;;
        varnish_nginx_apache)
            svc_enable_now nginx apache2 varnish
            ;;
        varnish_nginx_phpfpm)
            svc_disable_now apache2
            svc_enable_now nginx varnish
            ;;
        *)
            svc_disable_now apache2 varnish
            svc_enable_now nginx
            ;;
    esac
    for v in $AKPANEL_PHP_VERSIONS; do
        svc_enable_now "php${v}-fpm"
    done
    svc_enable_now bind9 named mariadb mysql redis-server postfix dovecot
    configure_postfix_submission
}

# Animated task runner — bar follows akp_progress from inside the step
run_task() {
    local task_title="$1"
    local start_pct="$2"
    local end_pct="$3"
    shift 3
    local cmd="$*"

    akp_progress "$start_pct" "$task_title"

    if [ "$VERBOSE" = true ]; then
        echo -e "\n${BOLD}${CYAN}▶ [${start_pct}%] ${task_title}...${NC}"
        eval "$cmd"
        local status=$?
        if [ $status -eq 0 ]; then
            echo -e "${GREEN}✓ Completed: ${task_title}${NC}"
        else
            echo -e "${RED}✗ Warning/Error during: ${task_title}${NC}"
        fi
        return $status
    fi

    eval "$cmd" >> "$LOG_FILE" 2>&1 &
    local pid=$!

    local spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local spin_idx=0

    while kill -0 $pid 2>/dev/null; do
        local spin_char="${spinner[$spin_idx]}"
        spin_idx=$(( (spin_idx + 1) % 10 ))

        local cur_pct=$start_pct
        local live_title="$task_title"
        if [ -f "$PROGRESS_FILE" ]; then
            local raw
            raw=$(head -n1 "$PROGRESS_FILE" 2>/dev/null || true)
            if [ -n "$raw" ]; then
                cur_pct="${raw%%|*}"
                live_title="${raw#*|}"
            fi
        fi
        [[ "$cur_pct" =~ ^[0-9]+$ ]] || cur_pct=$start_pct
        [ "$cur_pct" -lt "$start_pct" ] && cur_pct=$start_pct
        [ "$cur_pct" -gt "$end_pct" ] && cur_pct=$end_pct
        [ ${#live_title} -gt 42 ] && live_title="${live_title:0:39}..."

        local width=22
        local filled=$(( (cur_pct * width) / 100 ))
        local empty=$(( width - filled ))
        [ $empty -lt 0 ] && empty=0
        local bar=""
        local i
        for ((i=0; i<filled; i++)); do bar="${bar}█"; done
        for ((i=0; i<empty; i++)); do bar="${bar}░"; done

        printf "\r  ${PURPLE}%s${NC} ${BOLD}%-42s${NC} [${GREEN}%s${NC}] ${YELLOW}%3d%%${NC} " "$spin_char" "$live_title" "$bar" "$cur_pct"
        sleep 0.12
    done

    wait $pid
    local exit_code=$?

    local width=22
    local bar=""
    local i
    for ((i=0; i<width; i++)); do bar="${bar}█"; done

    if [ $exit_code -eq 0 ]; then
        printf "\r  ${GREEN}✓${NC} ${BOLD}%-42s${NC} [${GREEN}%s${NC}] ${GREEN}%3d%%${NC}\n" "$task_title" "$bar" "$end_pct"
    else
        printf "\r  ${YELLOW}✓${NC} ${BOLD}%-42s${NC} [${GREEN}%s${NC}] ${GREEN}%3d%%${NC}\n" "$task_title" "$bar" "$end_pct"
    fi
    return 0
}

provision_bind_master_zone() {
    local hostname="$1"
    local ns1="$2"
    local ns2="$3"
    local ip="$4"
    local root_domain="$5"
    local host_label=""

    [ -z "$hostname" ] || [ -z "$root_domain" ] || [ -z "$ip" ] && return 0

    if [ "$hostname" != "$root_domain" ]; then
        host_label="${hostname%.${root_domain}}"
        [ "$host_label" = "$hostname" ] && host_label=""
    fi

    mkdir -p /etc/bind/zones /etc/akpanel
    if [ -f /etc/bind/named.conf ] && ! grep -q 'named.conf.local' /etc/bind/named.conf 2>/dev/null; then
        echo 'include "/etc/bind/named.conf.local";' >> /etc/bind/named.conf
    fi

    local serial
    serial=$(date +%Y%m%d%H)
    local zone_file="/etc/bind/zones/db.${root_domain}"
    cat > "$zone_file" << ZONE_EOF
\$TTL 14400
@ IN SOA ${ns1}. admin.${root_domain}. (
    ${serial}
    3600
    1800
    604800
    86400
)

@                        14400 IN NS     ${ns1}.
@                        14400 IN NS     ${ns2}.
@                        14400 IN A      ${ip}
ns1                      14400 IN A      ${ip}
ns2                      14400 IN A      ${ip}
www                      14400 IN A      ${ip}
mail                     14400 IN A      ${ip}
*                        14400 IN A      ${ip}
@                        14400 IN MX 10  mail.${root_domain}.
@                        14400 IN TXT    "v=spf1 a mx ip4:${ip} ~all"
_dmarc                   14400 IN TXT    "v=DMARC1; p=none; sp=none"
ZONE_EOF
    if [ -n "$host_label" ] && [ "$host_label" != "ns1" ] && [ "$host_label" != "ns2" ] && [ "$host_label" != "www" ] && [ "$host_label" != "mail" ]; then
        echo "${host_label}                      14400 IN A      ${ip}" >> "$zone_file"
    fi

    local zone_block
    zone_block=$(cat << ZONE_CONF
zone "${root_domain}" {
    type master;
    file "${zone_file}";
    allow-transfer { none; };
    allow-query { any; };
};
ZONE_CONF
)
    touch /etc/bind/named.conf.local
    if ! grep -q "zone \"${root_domain}\"" /etc/bind/named.conf.local 2>/dev/null; then
        printf '\n%s\n' "$zone_block" >> /etc/bind/named.conf.local
    fi

    named-checkzone "$root_domain" "$zone_file" >> "$LOG_FILE" 2>&1 || true
    named-checkconf >> "$LOG_FILE" 2>&1 || true
    rndc reload "$root_domain" >> "$LOG_FILE" 2>&1 || \
        systemctl reload bind9 >> "$LOG_FILE" 2>&1 || \
        systemctl reload named >> "$LOG_FILE" 2>&1 || \
        service bind9 reload >> "$LOG_FILE" 2>&1 || true

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    cat > /etc/akpanel/dns_zones.json << JSON_EOF
[
  {
    "domain": "${root_domain}",
    "owner_user": "root",
    "server_ip": "${ip}",
    "email_admin": "hostmaster@${root_domain}",
    "serial": "${serial}",
    "bind_status": "synced",
    "created_at": "${now}",
    "updated_at": "${now}",
    "records": [
      {"name": "@", "type": "NS", "value": "${ns1}.", "ttl": 14400},
      {"name": "@", "type": "NS", "value": "${ns2}.", "ttl": 14400},
      {"name": "@", "type": "A", "value": "${ip}", "ttl": 14400},
      {"name": "ns1", "type": "A", "value": "${ip}", "ttl": 14400, "comment": "Glue Record NS1"},
      {"name": "ns2", "type": "A", "value": "${ip}", "ttl": 14400, "comment": "Glue Record NS2"},
      {"name": "www", "type": "A", "value": "${ip}", "ttl": 14400},
      {"name": "mail", "type": "A", "value": "${ip}", "ttl": 14400},
      {"name": "*", "type": "A", "value": "${ip}", "ttl": 14400, "comment": "Wildcard A"},
      {"name": "@", "type": "MX", "value": "mail.${root_domain}.", "ttl": 14400, "priority": 10},
      {"name": "@", "type": "TXT", "value": "v=spf1 a mx ip4:${ip} ~all", "ttl": 14400},
      {"name": "_dmarc", "type": "TXT", "value": "v=DMARC1; p=none; sp=none", "ttl": 14400}
    ]
  }
]
JSON_EOF
    echo "BIND master zone provisioned for ${root_domain} (${hostname} -> ${ip})" >> "$LOG_FILE"
}

write_hostname_nginx_vhost() {
    local hostname="$1"
    local safe_name
    safe_name=$(echo "$hostname" | tr '.' '_')
    mkdir -p /var/www/html/.well-known/acme-challenge
    chmod -R 755 /var/www/html/.well-known 2>/dev/null || true
    cat << NGINX_EOF > "/etc/nginx/sites-available/akpanel-hostname-${safe_name}.conf"
# AKpanel Panel Hostname — auto-managed by install.sh
server {
    listen 80;
    listen [::]:80;
    server_name ${hostname};

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${hostname};

    ssl_certificate /etc/akpanel/ssl/server/fullchain.pem;
    ssl_certificate_key /etc/akpanel/ssl/server/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/html;
        default_type text/plain;
        allow all;
    }

    location / {
        return 302 https://\$host:2087\$request_uri;
    }
}
NGINX_EOF
    ln -sfn "/etc/nginx/sites-available/akpanel-hostname-${safe_name}.conf" "/etc/nginx/sites-enabled/akpanel-hostname-${safe_name}.conf"
    nginx -t >> "$LOG_FILE" 2>&1 && systemctl reload nginx >> "$LOG_FILE" 2>&1 || service nginx reload >> "$LOG_FILE" 2>&1 || true
}

# Configure optional hostname, nameservers, BIND zone, and SSL after panel is online
configure_panel_identity() {
    [ -z "$AKPANEL_HOSTNAME" ] && return 0

    echo "=== Configuring panel identity: ${AKPANEL_HOSTNAME} ===" >> "$LOG_FILE"

    hostnamectl set-hostname "$AKPANEL_HOSTNAME" 2>> "$LOG_FILE" || echo "$AKPANEL_HOSTNAME" > /etc/hostname

    local ADMIN_EMAIL="${AKPANEL_ADMIN_EMAIL:-admin@${AKPANEL_HOSTNAME}}"
    local NS1="${AKPANEL_NS1:-}"
    local NS2="${AKPANEL_NS2:-}"
    local ROOT_DOMAIN
    ROOT_DOMAIN=$(echo "$AKPANEL_HOSTNAME" | awk -F. '{if (NF>=2) print $(NF-1)"."$NF; else print $0}')
    [ -z "$NS1" ] && NS1="ns1.${ROOT_DOMAIN}"
    [ -z "$NS2" ] && NS2="ns2.${ROOT_DOMAIN}"

    cat << EOF > /etc/akpanel/server_settings.json
{
  "hostname": "${AKPANEL_HOSTNAME}",
  "admin_email": "${ADMIN_EMAIL}",
  "panel_port": 2087,
  "client_port": 2083,
  "primary_ns": "${NS1}",
  "secondary_ns": "${NS2}",
  "shared_ip": "${SERVER_IP}",
  "ip_stack_mode": "dual",
  "timezone": "UTC",
  "language": "en",
  "auto_renew_ssl": true,
  "force_https": false,
  "session_timeout_mins": 60,
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

    cat << EOF > /etc/akpanel/dns_settings.json
{
  "server_hostname": "${AKPANEL_HOSTNAME}",
  "primary_ns": "${NS1}",
  "secondary_ns": "${NS2}",
  "primary_ip": "${SERVER_IP}",
  "secondary_ip": "${SERVER_IP}",
  "default_ttl": 14400,
  "bind_enabled": true,
  "dnssec_enabled": false
}
EOF

    provision_bind_master_zone "$AKPANEL_HOSTNAME" "$NS1" "$NS2" "$SERVER_IP" "$ROOT_DOMAIN"

    mkdir -p /etc/akpanel/ssl/server "/etc/akpanel/ssl/${AKPANEL_HOSTNAME}" /var/www/html/.well-known/acme-challenge
    chmod -R 755 /var/www/html/.well-known 2>/dev/null || true

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/akpanel/ssl/server/privkey.pem \
        -out /etc/akpanel/ssl/server/fullchain.pem \
        -subj "/C=US/ST=Cloud/L=Server/O=AKpanel/CN=${AKPANEL_HOSTNAME}" >> "$LOG_FILE" 2>&1 || true
    cp -f /etc/akpanel/ssl/server/fullchain.pem "/etc/akpanel/ssl/${AKPANEL_HOSTNAME}/fullchain.pem" 2>/dev/null || true
    cp -f /etc/akpanel/ssl/server/privkey.pem "/etc/akpanel/ssl/${AKPANEL_HOSTNAME}/privkey.pem" 2>/dev/null || true
    chmod 600 /etc/akpanel/ssl/server/privkey.pem "/etc/akpanel/ssl/${AKPANEL_HOSTNAME}/privkey.pem" 2>/dev/null || true

    write_hostname_nginx_vhost "$AKPANEL_HOSTNAME"

    if [ ! -f /root/.acme.sh/acme.sh ]; then
        curl -fsSL https://get.acme.sh | sh -s "email=${ADMIN_EMAIL}" >> "$LOG_FILE" 2>&1 || true
    fi

    local ACME_BIN="/root/.acme.sh/acme.sh"
    local SSL_OK=false
    if [ -f "$ACME_BIN" ]; then
        echo "ACME Let's Encrypt for ${AKPANEL_HOSTNAME}" >> "$LOG_FILE"
        akp_progress 96 "Hostname SSL: Let's Encrypt"
        if "$ACME_BIN" --issue -d "$AKPANEL_HOSTNAME" -w /var/www/html --server letsencrypt --force >> "$LOG_FILE" 2>&1; then
            SSL_OK=true
        else
            echo "ACME ZeroSSL fallback for ${AKPANEL_HOSTNAME}" >> "$LOG_FILE"
            akp_progress 97 "Hostname SSL: ZeroSSL fallback"
            if "$ACME_BIN" --issue -d "$AKPANEL_HOSTNAME" -w /var/www/html --server zerossl --force >> "$LOG_FILE" 2>&1; then
                SSL_OK=true
            fi
        fi
    fi

    if [ "$SSL_OK" = true ] && [ -f "$ACME_BIN" ]; then
        "$ACME_BIN" --install-cert -d "$AKPANEL_HOSTNAME" \
            --key-file /etc/akpanel/ssl/server/privkey.pem \
            --fullchain-file /etc/akpanel/ssl/server/fullchain.pem \
            --reloadcmd "service nginx reload 2>/dev/null || true" >> "$LOG_FILE" 2>&1 || SSL_OK=false
        if [ "$SSL_OK" = true ]; then
            cp -f /etc/akpanel/ssl/server/fullchain.pem "/etc/akpanel/ssl/${AKPANEL_HOSTNAME}/fullchain.pem" 2>/dev/null || true
            cp -f /etc/akpanel/ssl/server/privkey.pem "/etc/akpanel/ssl/${AKPANEL_HOSTNAME}/privkey.pem" 2>/dev/null || true
            chmod 600 /etc/akpanel/ssl/server/privkey.pem "/etc/akpanel/ssl/${AKPANEL_HOSTNAME}/privkey.pem" 2>/dev/null || true
            write_hostname_nginx_vhost "$AKPANEL_HOSTNAME"
            echo "Trusted Hostname SSL installed for ${AKPANEL_HOSTNAME}" >> "$LOG_FILE"
        fi
    else
        echo "ACME not ready (rate limit or DNS). Keeping self-signed fallback for ${AKPANEL_HOSTNAME}" >> "$LOG_FILE"
    fi

    systemctl restart akpanel >> "$LOG_FILE" 2>&1 || true
}

# ------------------------------------------------------------------------------
# STEP 1: Pre-Flight Checks & Architecture (15%)
# ------------------------------------------------------------------------------
task_step1() {
    akp_progress 5 "Checking architecture and root"
    sleep 0.3
    akp_progress 15 "System checks complete"
}
run_task "Checking system requirements & arch" 0 15 task_step1

# ------------------------------------------------------------------------------
# STEP 2: Updating APT & Base Dependencies (35%)
# ------------------------------------------------------------------------------
task_step2() {
    export DEBIAN_FRONTEND=noninteractive
    local APT_OPTS="-y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold"

    if [ "$VERBOSE" = true ]; then
        apt-get update -y
        apt-get install $APT_OPTS \
            curl wget git unzip zip tar software-properties-common sudo procps net-tools \
            sqlite3 libsqlite3-dev build-essential ca-certificates gnupg lsb-release ufw acl
    else
        akp_crawl 16 24 "Refreshing apt indexes" apt-get update -y || true
        akp_crawl 24 35 "Installing base utilities" apt-get install $APT_OPTS \
            curl wget git unzip zip tar software-properties-common sudo procps net-tools \
            sqlite3 libsqlite3-dev build-essential ca-certificates gnupg lsb-release ufw acl || true
    fi
}
run_task "Updating repositories & base utilities" 15 35 task_step2

# ------------------------------------------------------------------------------
# STEP 3: Web Server Engines, Multi-PHP & MariaDB (60%)
# ------------------------------------------------------------------------------
task_step3() {
    export DEBIAN_FRONTEND=noninteractive
    local APT_OPTS="-y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold"

    mkdir -p /etc/apt/keyrings /etc/apt/sources.list.d
    local PPA_ADDED=false

    akp_progress 36 "Adding PHP repository"

    if [[ "$UBUNTU_CODENAME" =~ ^(focal|jammy|noble)$ ]]; then
        if LC_ALL=C.UTF-8 add-apt-repository -y ppa:ondrej/php >> "$LOG_FILE" 2>&1; then
            PPA_ADDED=true
        fi
    fi

    if [ "$PPA_ADDED" = false ]; then
        curl -fsSL https://packages.sury.org/php/apt.gpg 2>/dev/null | gpg --dearmor --yes -o /etc/apt/keyrings/ondrej-php.gpg 2>>"$LOG_FILE" || \
        curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x14AA40EC0831756756D7F66C4F4EA0AAE5267A6C" 2>/dev/null | gpg --dearmor --yes -o /etc/apt/keyrings/ondrej-php.gpg 2>>"$LOG_FILE" || true

        local FALLBACK_SUITE="noble"
        [ "$UBUNTU_CODENAME" = "focal" ] && FALLBACK_SUITE="focal"
        [ "$UBUNTU_CODENAME" = "jammy" ] && FALLBACK_SUITE="jammy"

        echo "deb [signed-by=/etc/apt/keyrings/ondrej-php.gpg] https://ppa.launchpadcontent.net/ondrej/php/ubuntu ${FALLBACK_SUITE} main" > /etc/apt/sources.list.d/ondrej-ubuntu-php.list
    fi

    if [ "$VERBOSE" = true ]; then
        apt-get update -y
        apt-get install $APT_OPTS \
            nginx apache2 varnish mariadb-server bind9 bind9utils dnsutils postfix postfix-pcre \
            dovecot-core dovecot-imapd dovecot-pop3d opendkim opendkim-tools spamassassin redis-server pure-ftpd
        a2enmod rewrite proxy proxy_fcgi proxy_http headers
        apt-get install $APT_OPTS $(build_php_package_list) \
            roundcube roundcube-core roundcube-mysql phpmyadmin || apt-get install $APT_OPTS php-cli php-fpm php-mysql php-curl php-mbstring php-xml php-zip php-gd roundcube roundcube-core roundcube-mysql phpmyadmin
    else
        akp_crawl 36 38 "Refreshing apt after PHP repo" apt-get update -y
        akp_crawl 38 48 "Installing nginx, BIND, MariaDB, mail" apt-get install $APT_OPTS \
            nginx apache2 varnish mariadb-server bind9 bind9utils dnsutils postfix postfix-pcre \
            dovecot-core dovecot-imapd dovecot-pop3d opendkim opendkim-tools spamassassin redis-server pure-ftpd
        a2enmod rewrite proxy proxy_fcgi proxy_http headers >> "$LOG_FILE" 2>&1 || true
        akp_crawl 48 55 "Installing PHP, Roundcube, phpMyAdmin" apt-get install $APT_OPTS $(build_php_package_list) \
            roundcube roundcube-core roundcube-mysql phpmyadmin || \
        akp_crawl 48 55 "Installing PHP fallback packages" apt-get install $APT_OPTS \
            php-cli php-fpm php-common php-mysql php-curl php-mbstring php-xml php-zip php-gd roundcube roundcube-core roundcube-mysql phpmyadmin
    fi

    akp_progress 55 "Moving Apache off port 80"

    # Nginx owns the public HTTP/HTTPS ports. Apache is an internal PHP/
    # .htaccess backend on 127.0.0.1:8081; otherwise both daemons compete for
    # port 80 and hosted domains cannot be served reliably.
    if [ -f /etc/apache2/ports.conf ]; then
        sed -i 's/^[[:space:]]*Listen[[:space:]]\+80[[:space:]]*$/Listen 127.0.0.1:8081/' /etc/apache2/ports.conf
        sed -i 's/^[[:space:]]*Listen[[:space:]]\+443[[:space:]]*$/Listen 127.0.0.1:8444/' /etc/apache2/ports.conf
        rm -f /etc/apache2/sites-enabled/000-default.conf /etc/apache2/sites-enabled/default-ssl.conf
    fi

    akp_progress 56 "Installing acme.sh"
    if [ ! -f /root/.acme.sh/acme.sh ]; then
        curl -fsSL https://get.acme.sh | sh -s email=admin@akpanel.site >> "$LOG_FILE" 2>&1 || \
        (git clone --depth 1 https://github.com/acmesh-official/acme.sh.git /root/.acme.sh-repo >> "$LOG_FILE" 2>&1 && cd /root/.acme.sh-repo && ./acme.sh --install -m admin@akpanel.site >> "$LOG_FILE" 2>&1) || true
    fi
    ln -sfn /root/.acme.sh/acme.sh /usr/local/bin/acme.sh 2>/dev/null || true
    if [ -f /root/.acme.sh/acme.sh ]; then
        /root/.acme.sh/acme.sh --set-default-ca --server letsencrypt >> "$LOG_FILE" 2>&1 || true
    fi
    mkdir -p /etc/cron.d /var/www/html/.well-known/acme-challenge
    chmod -R 777 /var/www/html/.well-known 2>/dev/null || true
    echo "0 2 * * * root /root/.acme.sh/acme.sh --cron --home /root/.acme.sh > /var/log/akpanel-ssl-renew.log 2>&1" > /etc/cron.d/akpanel-ssl-renew
    chmod 644 /etc/cron.d/akpanel-ssl-renew 2>/dev/null || true

    akp_progress 58 "Configuring BIND 9"
    # Setup BIND 9 Authoritative Nameserver configuration
    mkdir -p /etc/bind /var/cache/bind /etc/bind/zones
    cat << 'EOF' > /etc/bind/named.conf.options
options {
    directory "/var/cache/bind";

    listen-on port 53 { any; };
    listen-on-v6 { any; };

    allow-query { any; };
    allow-query-cache { localhost; 127.0.0.1/32; };

    recursion no;
    allow-transfer { none; };

    forwarders {
        1.1.1.1;
        8.8.8.8;
    };

    dnssec-validation auto;
    auth-nxdomain no;
    max-cache-size 128M;
};
EOF
    mkdir -p /etc/bind/keys
    if [ ! -s /etc/bind/akpanel-acme.key ]; then
        tsig-keygen -a hmac-sha256 akpanel-acme > /etc/bind/akpanel-acme.key 2>/dev/null || true
    fi
    if [ -s /etc/bind/akpanel-acme.key ]; then
        cp -a /etc/bind/akpanel-acme.key /etc/bind/keys/akpanel-acme.conf
        chown root:bind /etc/bind/akpanel-acme.key /etc/bind/keys/akpanel-acme.conf 2>/dev/null || true
        chmod 640 /etc/bind/akpanel-acme.key /etc/bind/keys/akpanel-acme.conf 2>/dev/null || true
        # Include the TSIG key once. named.conf already includes options + local;
        # repeating the include there defines the same key twice and BIND exits.
        for _ak_bind_conf in /etc/bind/named.conf.options /etc/bind/named.conf.local /etc/bind/named.conf; do
            [ -f "$_ak_bind_conf" ] && sed -i '/akpanel-acme\.key/d;/akpanel-acme\.conf/d' "$_ak_bind_conf" 2>/dev/null || true
        done
        sed -i '1i include "/etc/bind/akpanel-acme.key";' /etc/bind/named.conf
    fi
    named-checkconf >> "$LOG_FILE" 2>&1 || true
    systemctl enable bind9 >> "$LOG_FILE" 2>&1 || systemctl enable named >> "$LOG_FILE" 2>&1 || true
    systemctl restart bind9 >> "$LOG_FILE" 2>&1 || systemctl restart named >> "$LOG_FILE" 2>&1 || true
    akp_progress 60 "Web stack packages ready"
}
run_task "Installing Nginx, Multi-PHP & MariaDB" 35 60 task_step3

# ------------------------------------------------------------------------------
# STEP 4: DB Users, Directories & phpMyAdmin SSO (75%)
# ------------------------------------------------------------------------------
task_step4() {
    akp_progress 61 "Starting MariaDB"
    service mariadb start >> "$LOG_FILE" 2>&1 || service mysql start >> "$LOG_FILE" 2>&1 || systemctl start mariadb >> "$LOG_FILE" 2>&1 || true
    sleep 1

    run_mysql() {
        mysql -u root -pakpanel123 "$@" 2>/dev/null || mysql -u root "$@" 2>/dev/null || mysql "$@" 2>/dev/null || true
    }

    run_mysql -e "CREATE USER IF NOT EXISTS 'ak_admin'@'%' IDENTIFIED BY 'akpanel123'; GRANT ALL PRIVILEGES ON *.* TO 'ak_admin'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
    run_mysql -e "CREATE USER IF NOT EXISTS 'ak_admin'@'localhost' IDENTIFIED BY 'akpanel123'; GRANT ALL PRIVILEGES ON *.* TO 'ak_admin'@'localhost' WITH GRANT OPTION; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
    run_mysql -e "CREATE USER IF NOT EXISTS 'ak_admin'@'127.0.0.1' IDENTIFIED BY 'akpanel123'; GRANT ALL PRIVILEGES ON *.* TO 'ak_admin'@'127.0.0.1' WITH GRANT OPTION; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
    run_mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'akpanel123'; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1

    run_mysql -e "CREATE DATABASE IF NOT EXISTS phpmyadmin DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'pma'@'localhost' IDENTIFIED BY 'pma_akpanel_secret_pass'; GRANT ALL PRIVILEGES ON phpmyadmin.* TO 'pma'@'localhost'; CREATE USER IF NOT EXISTS 'phpmyadmin'@'localhost' IDENTIFIED BY 'pma_akpanel_secret_pass'; GRANT ALL PRIVILEGES ON phpmyadmin.* TO 'phpmyadmin'@'localhost'; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
    if [ -f /usr/share/phpmyadmin/sql/create_tables.sql ]; then
        run_mysql phpmyadmin < /usr/share/phpmyadmin/sql/create_tables.sql >> "$LOG_FILE" 2>&1 || true
    fi

    # Roundcube: apt's dbconfig-common creates user roundcube with a random
    # password. CREATE USER IF NOT EXISTS would leave that password in place
    # while we wrote a different DSN → SQLSTATE 1045 and Roundcube "Oops".
    mkdir -p /etc/akpanel/secrets
    if [ ! -s /etc/akpanel/secrets/roundcube_db_pass ] || [ "$(wc -c < /etc/akpanel/secrets/roundcube_db_pass | tr -d ' ')" -lt 24 ]; then
        tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 > /etc/akpanel/secrets/roundcube_db_pass
    fi
    if [ ! -s /etc/akpanel/secrets/roundcube_des_key ] || [ "$(wc -c < /etc/akpanel/secrets/roundcube_des_key | tr -d ' ')" -lt 24 ]; then
        tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 > /etc/akpanel/secrets/roundcube_des_key
    fi
    chmod 600 /etc/akpanel/secrets/roundcube_db_pass /etc/akpanel/secrets/roundcube_des_key 2>/dev/null || true
    RC_DB_PASS=$(tr -d '\n' < /etc/akpanel/secrets/roundcube_db_pass)
    RC_DES_KEY=$(tr -d '\n' < /etc/akpanel/secrets/roundcube_des_key | head -c 24)

    run_mysql -e "CREATE DATABASE IF NOT EXISTS roundcubemail DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >> "$LOG_FILE" 2>&1
    run_mysql -e "CREATE USER IF NOT EXISTS 'roundcube'@'localhost' IDENTIFIED BY '${RC_DB_PASS}'; CREATE USER IF NOT EXISTS 'roundcube'@'127.0.0.1' IDENTIFIED BY '${RC_DB_PASS}'; ALTER USER 'roundcube'@'localhost' IDENTIFIED BY '${RC_DB_PASS}'; ALTER USER 'roundcube'@'127.0.0.1' IDENTIFIED BY '${RC_DB_PASS}'; GRANT ALL PRIVILEGES ON roundcubemail.* TO 'roundcube'@'localhost'; GRANT ALL PRIVILEGES ON roundcubemail.* TO 'roundcube'@'127.0.0.1'; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
    if [ -f /usr/share/roundcube/SQL/mysql.initial.sql ]; then
        run_mysql roundcubemail < /usr/share/roundcube/SQL/mysql.initial.sql >> "$LOG_FILE" 2>&1 || true
    elif [ -f /usr/share/roundcube/SQL/mysql/initial.sql ]; then
        run_mysql roundcubemail < /usr/share/roundcube/SQL/mysql/initial.sql >> "$LOG_FILE" 2>&1 || true
    fi

    mkdir -p /etc/roundcube /var/log/roundcube /var/lib/roundcube/temp
    chown www-data:www-data /var/log/roundcube /var/lib/roundcube/temp 2>/dev/null || true
    cat << EOF > /etc/roundcube/config.inc.php
<?php
\$config = [];
\$config['db_dsnw'] = 'mysql://roundcube:${RC_DB_PASS}@127.0.0.1/roundcubemail';
\$config['default_host'] = '127.0.0.1';
\$config['imap_host'] = '127.0.0.1:143';
\$config['default_port'] = 143;
\$config['smtp_server'] = '127.0.0.1';
\$config['smtp_host'] = '127.0.0.1:587';
\$config['smtp_port'] = 587;
\$config['smtp_user'] = '%u';
\$config['smtp_pass'] = '%p';
\$config['support_url'] = '';
\$config['product_name'] = 'AKpanel Webmail';
\$config['des_key'] = '${RC_DES_KEY}';
\$config['plugins'] = [];
\$config['skin'] = 'elastic';
\$config['enable_spellcheck'] = false;
\$config['auto_create_user'] = true;
\$config['force_https'] = false;
\$config['use_https'] = false;
\$config['log_dir'] = '/var/log/roundcube/';
\$config['temp_dir'] = '/var/lib/roundcube/temp/';
EOF
    chown root:www-data /etc/roundcube/config.inc.php 2>/dev/null || true
    chmod 640 /etc/roundcube/config.inc.php 2>/dev/null || true
    if [ -d /var/lib/roundcube ] && [ ! -L /var/www/roundcube ]; then
        rm -rf /var/www/roundcube
        ln -sfn /var/lib/roundcube /var/www/roundcube
    fi

    cat << 'EOF' > /etc/phpmyadmin/config-db.php
<?php
$dbuser='pma';
$dbpass='pma_akpanel_secret_pass';
$basepath='';
$dbname='phpmyadmin';
$dbserver='localhost';
$dbport='3306';
$dbtype='mysql';
EOF
    chmod 644 /etc/phpmyadmin/config-db.php 2>/dev/null || true
    chmod 644 /etc/phpmyadmin/config-db.php 2>/dev/null || true

    mkdir -p /etc/phpmyadmin/conf.d /var/lib/phpmyadmin/sessions
    chmod 1777 /var/lib/phpmyadmin/sessions 2>/dev/null || true
    cat << 'EOF' > /etc/phpmyadmin/conf.d/01-akpanel.php
<?php
$cfg['PmaAbsoluteUri'] = '/phpmyadmin/';
$cfg['blowfish_secret'] = 'akpanel_enterprise_super_secret_key_32bytes_long!';
$cfg['Servers'][1]['auth_type'] = 'signon';
$cfg['Servers'][1]['host'] = '127.0.0.1';
$cfg['Servers'][1]['port'] = 3306;
$cfg['Servers'][1]['SignonSession'] = 'AKpanelPMA';
$cfg['Servers'][1]['SignonURL'] = '/phpmyadmin/signon.php';
$cfg['Servers'][1]['AllowNoPassword'] = false;
$cfg['Servers'][1]['controluser'] = 'pma';
$cfg['Servers'][1]['controlpass'] = 'pma_akpanel_secret_pass';
$cfg['Servers'][1]['pmadb'] = 'phpmyadmin';
$cfg['Servers'][1]['SessionTimeToLive'] = 86400;
$cfg['SessionSavePath'] = '/var/lib/phpmyadmin/sessions';
$cfg['CookieSameSite'] = 'Lax';
$cfg['CookieSecure'] = false;
$cfg['CookiePath'] = '/';
$cfg['LoginCookieValidity'] = 86400;
$cfg['LoginCookieValidityDisableWarning'] = true;
$cfg['ExecTimeLimit'] = 300;
EOF

    cat << 'EOF' > /usr/share/phpmyadmin/signon.php
<?php
session_name('AKpanelPMA');
session_save_path('/var/lib/phpmyadmin/sessions');
@session_start();

$token = isset($_GET['token']) ? $_GET['token'] : (isset($_POST['token']) ? $_POST['token'] : '');
$user = '';
$pass = '';

if (!empty($token)) {
    $tokenClean = preg_replace('/[^a-zA-Z0-9_-]/', '', $token);
    $tokenFile = '/var/lib/phpmyadmin/sessions/sso_' . $tokenClean . '.json';
    if (file_exists($tokenFile)) {
        $content = file_get_contents($tokenFile);
        $data = json_decode($content, true);
        if ($data && isset($data['username']) && isset($data['password'])) {
            $user = $data['username'];
            $pass = $data['password'];
            @unlink($tokenFile);
        }
    }
}

if (!empty($user) && !empty($pass)) {
    $_SESSION['PMA_single_signon_user'] = $user;
    $_SESSION['PMA_single_signon_password'] = $pass;
    $_SESSION['PMA_single_signon_host'] = '127.0.0.1';
    $_SESSION['PMA_single_signon_port'] = 3306;
    session_write_close();
    header('Location: /phpmyadmin/index.php');
    exit;
}

unset($_SESSION['PMA_single_signon_user']);
unset($_SESSION['PMA_single_signon_password']);
session_write_close();

if (!empty($token)) {
    echo '<!DOCTYPE html><html><head><title>AKpanel - phpMyAdmin SSO</title><meta http-equiv="refresh" content="2;url=/databases"></head><body style="font-family:sans-serif;background:#090a0f;color:#fff;text-align:center;padding:50px;"><h2>SSO Token Expired or Invalid</h2><p>Redirecting back to AKpanel...</p></body></html>';
    exit;
}

header('Location: /login');
exit;
EOF
    chmod 644 /usr/share/phpmyadmin/signon.php 2>/dev/null || true
    ln -sfn /usr/share/phpmyadmin /usr/share/phpmyadmin/phpmyadmin 2>/dev/null || true

    mkdir -p /etc/akpanel /var/www/sites/default/public /var/log/akpanel /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/bind/zones /etc/opendkim/keys /var/vmail "$INSTALL_DIR"
    chmod 700 /etc/opendkim/keys 2>/dev/null || true
    chmod 755 /var/vmail 2>/dev/null || true

    cat << 'HTML' > /var/www/sites/default/public/index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>AKpanel Web Server</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #1e293b; padding: 2.5rem; border-radius: 16px; border: 1px solid #334155; text-align: center; max-width: 500px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
        h1 { color: #818cf8; margin-top: 0; font-size: 2rem; }
        p { color: #94a3b8; line-height: 1.6; }
        .badge { display: inline-block; background: #312e81; color: #a5b4fc; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; }
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">AKpanel Server</div>
        <h1>Server Ready 🚀</h1>
        <p>Nginx and Multi-PHP are running smoothly on your server.</p>
        <p>You can manage websites and databases from your <strong>AKpanel Dashboard</strong>.</p>
    </div>
</body>
</html>
HTML
    chown -R www-data:www-data /var/www/sites 2>/dev/null || true

    # Save hashed credentials in root.auth (NO plain text on disk)
    local SALT=$(date +%s%N | sha256sum | head -c 16)
    local HASH=$(printf "%s:%s:akpanel_root_pepper" "$ROOT_ADMIN_PASS" "$SALT" | sha256sum | awk '{print $1}')
    
    cat << EOF > /etc/akpanel/root.auth
{
  "username": "root",
  "salt": "${SALT}",
  "hash": "${HASH}",
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
    chmod 600 /etc/akpanel/root.auth 2>/dev/null || true

    cat << EOF > /etc/akpanel/credentials.txt
==============================================================================
 👑 AKpanel Root Administrator Information
==============================================================================
 🌐 Root WHM Panel  : http://${SERVER_IP}:2087
 👤 Username        : root
 🔒 Password Storage: Salted SHA-256 Encrypted (/etc/akpanel/root.auth)
 🌐 Client Portal   : http://${SERVER_IP}:2083
 📅 Generated Date  : $(date)
==============================================================================
 🛡️ Security Note: The plain password was shown once at installation time.
 If forgotten, you can reset it anytime by running: akpanel-reset-password
==============================================================================
EOF
    chmod 600 /etc/akpanel/credentials.txt 2>/dev/null || true

    # CLI Root Password Reset Helper
    cat << 'CLI_EOF' > /usr/local/bin/akpanel-reset-password
#!/usr/bin/env bash
if [ "$(id -u)" -ne 0 ]; then
    echo "❌ Error: This command must be run as root."
    exit 1
fi
if [ -n "$1" ]; then
    NEW_PASS="$1"
else
    read -s -p "Enter new AKpanel root password: " NEW_PASS
    echo ""
fi
if [ ${#NEW_PASS} -lt 6 ]; then
    echo "❌ Error: Password must be at least 6 characters."
    exit 1
fi
SALT=$(date +%s%N | sha256sum | head -c 16)
HASH=$(printf "%s:%s:akpanel_root_pepper" "$NEW_PASS" "$SALT" | sha256sum | awk '{print $1}')
cat << AUTH_EOF > /etc/akpanel/root.auth
{
  "username": "root",
  "salt": "${SALT}",
  "hash": "${HASH}",
  "updated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
AUTH_EOF
chmod 600 /etc/akpanel/root.auth
echo "✓ AKpanel root password has been successfully updated!"
CLI_EOF
    chmod +x /usr/local/bin/akpanel-reset-password 2>/dev/null || true
}
run_task "Configuring phpMyAdmin SSO & security" 60 75 task_step4

# ------------------------------------------------------------------------------
# STEP 5: Deploying Binary & Systemd (90%)
# ------------------------------------------------------------------------------
task_step5() {
    if [ -f "$(pwd)/main.go" ] && [ -f "$(pwd)/go.mod" ]; then
        PROJECT_ROOT="$(pwd)"
    elif [ -d "/root/AKpanel" ] && [ -f "/root/AKpanel/main.go" ]; then
        PROJECT_ROOT="/root/AKpanel"
    else
        local TARGET_TAG="${AKPANEL_VERSION:-}"
        if [ -z "$TARGET_TAG" ] || [ "$TARGET_TAG" = "latest" ]; then
            local LATEST_JSON=$(curl -sSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null || true)
            local DETECTED_TAG=$(echo "$LATEST_JSON" | grep '"tag_name":' | head -n 1 | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' || true)
            if [ -n "$DETECTED_TAG" ]; then
                TARGET_TAG="$DETECTED_TAG"
            else
                TARGET_TAG="$DEFAULT_VERSION"
            fi
        fi

        local RELEASE_TAR="akpanel_${TARGET_TAG}_linux_${PKG_ARCH}.tar.gz"
        local DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${TARGET_TAG}/${RELEASE_TAR}"
        local TEMP_DIR=$(mktemp -d)

        if curl -sSL -f "$DOWNLOAD_URL" -o "${TEMP_DIR}/${RELEASE_TAR}" >> "$LOG_FILE" 2>&1; then
            mkdir -p "$INSTALL_DIR"
            tar -xzf "${TEMP_DIR}/${RELEASE_TAR}" -C "$INSTALL_DIR" >> "$LOG_FILE" 2>&1 || true
            rm -rf "$TEMP_DIR"
            PROJECT_ROOT="$INSTALL_DIR"
        else
            mkdir -p "$INSTALL_DIR"
            git clone "https://github.com/${GITHUB_REPO}.git" "$INSTALL_DIR" >> "$LOG_FILE" 2>&1 || true
            PROJECT_ROOT="$INSTALL_DIR"
        fi
    fi

    cd "$PROJECT_ROOT"

    # Always generate 100% working .env for 0.0.0.0 and Port 2087 and SQLite
    cat << 'EOF' > "$PROJECT_ROOT/.env"
APP_NAME=AKpanel
APP_ENV=production
APP_KEY=akpanel_production_secret_key_32
APP_DEBUG=false

LOG_CHANNEL=stack
LOG_LEVEL=info

SESSION_DRIVER=file
SESSION_LIFETIME=120

APP_URL=http://0.0.0.0:2087
APP_HOST=0.0.0.0
APP_PORT=2087

JWT_SECRET=akpanel_super_secret_jwt_key_64_bytes_long_entropy_string!

DB_CONNECTION=sqlite
DB_DATABASE=database/akpanel.sqlite
EOF
    mkdir -p "$PROJECT_ROOT/database"
    touch "$PROJECT_ROOT/database/akpanel.sqlite"

    # Ensure full codebase & assets in /opt/akpanel
    mkdir -p /opt/akpanel
    if [ ! -f "/opt/akpanel/public/build/app.js" ]; then
        if [ -d "$PWD/public/build" ]; then
            cp -r "$PWD/"* /opt/akpanel/ 2>/dev/null || true
        else
            git clone --depth 1 https://github.com/prefnex/AKpanel.git /opt/akpanel >> "$LOG_FILE" 2>&1 || true
        fi
    fi
    PROJECT_ROOT="/opt/akpanel"

    # Deploy pre-built binary from release assets if available
    if [ -f "$PROJECT_ROOT/release-assets/akpanel_v0.1.0_linux_${PKG_ARCH}.tar.gz" ]; then
        tar -xzf "$PROJECT_ROOT/release-assets/akpanel_v0.1.0_linux_${PKG_ARCH}.tar.gz" -C "$PROJECT_ROOT/" 2>/dev/null || true
    fi

    # Ensure binary
    if [ -f "$PROJECT_ROOT/akpanel" ]; then
        cp "$PROJECT_ROOT/akpanel" /usr/local/bin/akpanel
    elif [ -f "$PROJECT_ROOT/akpanel-bin" ]; then
        cp "$PROJECT_ROOT/akpanel-bin" /usr/local/bin/akpanel
    else
        if ! command -v go &> /dev/null; then
            wget -q https://go.dev/dl/go1.23.6.linux-amd64.tar.gz
            tar -C /usr/local -xzf go1.23.6.linux-amd64.tar.gz >> "$LOG_FILE" 2>&1 || true
            rm -f go1.23.6.linux-amd64.tar.gz
            export PATH="/usr/local/go/bin:${PATH}"
        fi

        if command -v npm &> /dev/null && [ ! -f "$PROJECT_ROOT/public/build/app.js" ]; then
            cd "$PROJECT_ROOT" && npm install >> "$LOG_FILE" 2>&1 && npm run build >> "$LOG_FILE" 2>&1 || true
        fi

        cd "$PROJECT_ROOT"
        go mod tidy >> "$LOG_FILE" 2>&1 || true
        go build -ldflags="-s -w" -o /usr/local/bin/akpanel main.go >> "$LOG_FILE" 2>&1 || true
    fi

    chmod +x /usr/local/bin/akpanel 2>/dev/null || true

    akp_progress 86 "Applying web stack profile (${AKPANEL_WEB_PROFILE})"
    configure_nginx_php
    write_install_metadata
    apply_webserver_profile
    akp_progress 88 "Stack daemons aligned to profile"

    # Setup Systemd Service
    if [ -d "/etc/systemd/system" ]; then
        cat << EOF > /etc/systemd/system/akpanel.service
[Unit]
Description=AKpanel Hosting Control Panel
After=network.target nginx.service mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_ROOT
ExecStart=/usr/local/bin/akpanel
Restart=always
RestartSec=3
Environment=APP_ENV=production
Environment=APP_PORT=2087
Environment=APP_HOST=0.0.0.0
Environment=APP_KEY=akpanel_production_secret_key_32
Environment=DB_CONNECTION=sqlite

[Install]
WantedBy=multi-user.target
EOF

        systemctl daemon-reload >> "$LOG_FILE" 2>&1 || true
        systemctl enable akpanel >> "$LOG_FILE" 2>&1 || true
        systemctl restart akpanel >> "$LOG_FILE" 2>&1 || true
    fi

    if ! pgrep -f "/usr/local/bin/akpanel" > /dev/null; then
        cd "$PROJECT_ROOT"
        nohup /usr/local/bin/akpanel > /var/log/akpanel/output.log 2>&1 &
        sleep 2
    fi
}
run_task "Deploying AKpanel binary & systemd" 75 90 task_step5

# ------------------------------------------------------------------------------
# STEP 6: Firewall, MOTD & Verification Health Check (100%)
# ------------------------------------------------------------------------------
task_step6() {
    akp_progress 91 "Opening firewall ports"
    if command -v ufw &>/dev/null; then
        ufw allow 22/tcp comment "SSH Remote Access" >> "$LOG_FILE" 2>&1 || true
        ufw allow 2087/tcp comment "AKpanel Root WHM" >> "$LOG_FILE" 2>&1 || true
        ufw allow 2083/tcp comment "AKpanel Client Portal" >> "$LOG_FILE" 2>&1 || true
        ufw allow 80/tcp comment "HTTP Web" >> "$LOG_FILE" 2>&1 || true
        ufw allow 443/tcp comment "HTTPS SSL" >> "$LOG_FILE" 2>&1 || true
        ufw allow 21/tcp comment "FTP Service" >> "$LOG_FILE" 2>&1 || true
        ufw allow 53 comment "DNS Service" >> "$LOG_FILE" 2>&1 || true
        ufw allow 53/tcp comment "DNS TCP" >> "$LOG_FILE" 2>&1 || true
        ufw allow 53/udp comment "DNS UDP" >> "$LOG_FILE" 2>&1 || true
		ufw allow 25/tcp comment "SMTP Mail" >> "$LOG_FILE" 2>&1 || true
        ufw allow 465/tcp comment "SMTPS" >> "$LOG_FILE" 2>&1 || true
        ufw allow 587/tcp comment "SMTP Submission" >> "$LOG_FILE" 2>&1 || true
        ufw allow 110/tcp comment "POP3" >> "$LOG_FILE" 2>&1 || true
        ufw allow 143/tcp comment "IMAP" >> "$LOG_FILE" 2>&1 || true
        ufw allow 993/tcp comment "IMAP SSL" >> "$LOG_FILE" 2>&1 || true
        ufw allow 995/tcp comment "POP3 SSL" >> "$LOG_FILE" 2>&1 || true
        
        if ufw status 2>/dev/null | grep -q "Status: active"; then
            ufw reload >> "$LOG_FILE" 2>&1 || true
        fi
    fi

    akp_progress 93 "Writing SSH login banner"
    # SSH banner via profile.d only. Do not install into /etc/update-motd.d —
    # PAM MOTD is shown to every SSH user and would duplicate this banner.
    mkdir -p /etc/profile.d
    rm -f /etc/update-motd.d/99-akpanel /etc/update-motd.d/99-akpanel.sh 2>/dev/null || true
    cat << 'MOTD_EOF' > /etc/profile.d/00-akpanel-motd.sh
#!/bin/bash
# Sourced from /etc/profile — interactive shells only.
[ -z "$PS1" ] && return
[ -n "$AKPANEL_MOTD_SHOWN" ] && return
AKPANEL_MOTD_SHOWN=1
export AKPANEL_MOTD_SHOWN

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"

PANEL_HOST=""
for _ak_try in \
    "$(sed -n 's/.*"hostname"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' /etc/akpanel/server_settings.json 2>/dev/null | head -1)" \
    "$(sed -n 's/.*"hostname"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' /etc/akpanel/install.conf 2>/dev/null | head -1)" \
    "$(sed -n 's/.*"server_hostname"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' /etc/akpanel/dns.json 2>/dev/null | head -1)" \
    "$(hostname -f 2>/dev/null)"; do
    _ak_try=$(echo "$_ak_try" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')
    case "$_ak_try" in
        ""|localhost|localhost.localdomain|*.localdomain) continue ;;
    esac
    echo "$_ak_try" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' && continue
    echo "$_ak_try" | grep -q ':' && continue
    echo "$_ak_try" | grep -q '\.' || continue
    PANEL_HOST="$_ak_try"
    break
done
unset _ak_try

if [ -n "$PANEL_HOST" ]; then
    if [ -f "/etc/akpanel/ssl/${PANEL_HOST}/fullchain.pem" ] || [ -f /etc/akpanel/ssl/server/fullchain.pem ]; then
        PANEL_SCHEME="https"
    else
        PANEL_SCHEME="http"
    fi
    ACCESS_HOST="$PANEL_HOST"
else
    PANEL_SCHEME="http"
    ACCESS_HOST="$SERVER_IP"
fi

echo -e "${PURPLE}${BOLD}"
cat << "BANNER"
    _    _  ______                  _ 
   / \  | |/ /  _ \ __ _ _ __   ___| |
  / _ \ | ' /| |_) / _` | '_ \ / _ \ |
 / ___ \| . \|  __/ (_| | | | |  __/ |
/_/   \_\_|\_\_|   \__,_|_| |_|\___|_|
BANNER
echo -e "${CYAN}  Next-Gen Cloud Server & Web Hosting Control Panel${NC}\n"

if [ "$(id -u)" -eq 0 ]; then
    MEM_TOTAL=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}')
    MEM_USED=$(free -m 2>/dev/null | awk '/^Mem:/{print $3}')
    DISK_TOTAL=$(df -h / 2>/dev/null | awk 'NR==2{print $2}')
    DISK_USED=$(df -h / 2>/dev/null | awk 'NR==2{print $3}')
    if systemctl is-active --quiet akpanel 2>/dev/null || pgrep -f "/usr/local/bin/akpanel" >/dev/null; then
        PANEL_STATUS="${GREEN}ONLINE / ACTIVE ●${NC}"
    else
        PANEL_STATUS="${RED}STOPPED ○${NC}"
    fi
    echo -e "${BOLD}🌐 Access Points & Control Panels:${NC}"
    echo -e "  👑 ${BOLD}Root / WHM Admin :${NC} ${YELLOW}${PANEL_SCHEME}://${ACCESS_HOST}:2087${NC}"
    echo -e "  👤 ${BOLD}Client Hosting   :${NC} ${YELLOW}${PANEL_SCHEME}://${ACCESS_HOST}:2083${NC}"
    echo -e "  🌐 ${BOLD}Web Sites (HTTP) :${NC} ${YELLOW}http://${ACCESS_HOST}${NC}"
    echo ""
    echo -e "${BOLD}📊 Server Health & Telemetry:${NC}"
    echo -e "  • ${BOLD}Panel Status:${NC} ${PANEL_STATUS}"
    echo -e "  • ${BOLD}Memory Usage:${NC} ${GREEN}${MEM_USED} MB${NC} / ${MEM_TOTAL} MB"
    echo -e "  • ${BOLD}Disk Space  :${NC} ${GREEN}${DISK_USED}${NC} / ${DISK_TOTAL}"
    if [ -n "$PANEL_HOST" ]; then
        echo -e "  • ${BOLD}Hostname    :${NC} ${CYAN}${PANEL_HOST}${NC}"
    fi
    echo -e "  • ${BOLD}Server IP   :${NC} ${CYAN}${SERVER_IP}${NC}"
else
    LOGIN_USER=$(id -un 2>/dev/null || echo "$USER")
    HOME_DIR="${HOME:-/home/${LOGIN_USER}}"
    SITES_DIR="${HOME_DIR}/domains"
    echo -e "${BOLD}👤 Account:${NC}"
    echo -e "  • ${BOLD}Username        :${NC} ${CYAN}${LOGIN_USER}${NC}"
    echo -e "  • ${BOLD}Home Directory  :${NC} ${CYAN}${HOME_DIR}${NC}"
    if [ -d "$SITES_DIR" ]; then
        echo -e "  • ${BOLD}Websites Path   :${NC} ${CYAN}${SITES_DIR}${NC}"
    fi
    echo ""
    echo -e "${BOLD}🌐 Your Access Points:${NC}"
    echo -e "  👤 ${BOLD}Client Hosting :${NC} ${YELLOW}${PANEL_SCHEME}://${ACCESS_HOST}:2083${NC}"
    echo -e "  🌐 ${BOLD}Web Sites      :${NC} ${YELLOW}http://${ACCESS_HOST}${NC}"
    if [ -n "$PANEL_HOST" ]; then
        echo -e "  • ${BOLD}Hostname       :${NC} ${CYAN}${PANEL_HOST}${NC}"
    fi
fi
echo ""
echo -e "${PURPLE}───────────────────────────────────────────────────────────────────────────────${NC}\n"

unset CYAN GREEN YELLOW PURPLE RED BOLD NC SERVER_IP PANEL_HOST ACCESS_HOST
unset PANEL_SCHEME PANEL_STATUS MEM_TOTAL MEM_USED DISK_TOTAL DISK_USED
unset LOGIN_USER HOME_DIR SITES_DIR
MOTD_EOF

    chmod 644 /etc/profile.d/00-akpanel-motd.sh 2>/dev/null || true

    akp_progress 94 "Waiting for panel on :2087"
    # Health Verification on Port 2087 & 2083
    local verified=false
    for ((i=1; i<=15; i++)); do
        if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:2087/ | grep -qE "200|301|302|401|403|404"; then
            verified=true
            break
        fi
        sleep 1
    done

    if [ "$verified" = false ]; then
        systemctl restart akpanel >> "$LOG_FILE" 2>&1 || true
        sleep 2
    fi

    akp_progress 95 "Panel hostname, BIND zone, SSL"
    configure_panel_identity
    write_install_metadata
    akp_progress 100 "Install complete"
}
run_task "Firewall, SSH MOTD & Health Verification" 90 100 task_step6

# Final Verification Status
PANEL_ONLINE=false
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:2087/ | grep -qE "200|301|302|401|403|404"; then
    PANEL_ONLINE=true
fi

echo -e "\n${GREEN}==============================================================================${NC}"
if [ "$PANEL_ONLINE" = true ]; then
    echo -e "${GREEN} 🎉 Congratulations! AKpanel is ONLINE and verified successfully!${NC}"
else
    echo -e "${YELLOW} ⚠️ AKpanel is installed. Starting up... (Check: systemctl status akpanel)${NC}"
fi
echo -e "${GREEN}==============================================================================${NC}"
echo -e "  Root WHM (IP)      : ${YELLOW}https://${SERVER_IP}:2087${NC}"
echo -e "  ${DIM}                     Plain http://${SERVER_IP}:2087 also works (no redirect on IP)${NC}"
if [ -n "$AKPANEL_HOSTNAME" ]; then
    echo -e "  Hostname (HTTPS)   : ${YELLOW}https://${AKPANEL_HOSTNAME}:2087${NC}"
    echo -e "  ${DIM}                     Needs DNS A record ${AKPANEL_HOSTNAME} -> ${SERVER_IP}${NC}"
fi
echo -e "  Client Portal (IP) : ${YELLOW}https://${SERVER_IP}:2083${NC}"
echo -e "  👤 Admin Username  : ${YELLOW}root${NC}"
echo -e "  🔑 Generated Pass  : ${BOLD}${RED}${ROOT_ADMIN_PASS}${NC} ${GREEN}(Randomly Generated)${NC}"
echo -e "  💾 Credentials File: ${CYAN}/etc/akpanel/credentials.txt${NC}"
echo -e "  📁 Websites Root   : ${CYAN}/var/www/sites${NC}"
echo -e "  ⚙️ Web Stack       : ${CYAN}${AKPANEL_WEB_PROFILE}${NC}"
echo -e "  🐘 PHP Versions    : ${CYAN}${AKPANEL_PHP_VERSIONS}${NC}"
echo -e "  ⚙️ Config Dir      : ${CYAN}/etc/akpanel${NC}"
echo -e "  📄 Installation Log: ${CYAN}${LOG_FILE}${NC}"
echo -e "${GREEN}==============================================================================${NC}\n"
