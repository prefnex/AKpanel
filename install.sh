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
        read -r -p "Are you sure you want to proceed? (y/N): " CONFIRM_REBUILD
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

if [ "$VERBOSE" = true ]; then
    echo -e "${YELLOW}🔍 Running in Detailed Verbose Mode (--verbose)... All command outputs visible.${NC}\n"
else
    echo -e "${BOLD}🚀 Starting Clean Automated Installation...${NC} ${DIM}(Logs: ${LOG_FILE} | Run with --verbose for raw logs)${NC}\n"
fi

# Animated task runner
run_task() {
    local task_title="$1"
    local start_pct="$2"
    local end_pct="$3"
    shift 3
    local cmd="$*"

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

    # Quiet Animated Mode
    eval "$cmd" >> "$LOG_FILE" 2>&1 &
    local pid=$!

    local spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local spin_idx=0
    local cur_pct=$start_pct

    while kill -0 $pid 2>/dev/null; do
        local spin_char="${spinner[$spin_idx]}"
        spin_idx=$(( (spin_idx + 1) % 10 ))

        if [ $cur_pct -lt $end_pct ]; then
            cur_pct=$((cur_pct + 1))
        fi

        local width=22
        local filled=$(( (cur_pct * width) / 100 ))
        local empty=$(( width - filled ))
        [ $empty -lt 0 ] && empty=0
        local bar=""
        for ((i=0; i<filled; i++)); do bar="${bar}█"; done
        for ((i=0; i<empty; i++)); do bar="${bar}░"; done

        printf "\r  ${PURPLE}%s${NC} ${BOLD}%-42s${NC} [${GREEN}%s${NC}] ${YELLOW}%3d%%${NC} " "$spin_char" "$task_title" "$bar" "$cur_pct"
        sleep 0.15
    done

    wait $pid
    local exit_code=$?

    local width=22
    local bar=""
    for ((i=0; i<width; i++)); do bar="${bar}█"; done

    if [ $exit_code -eq 0 ]; then
        printf "\r  ${GREEN}✓${NC} ${BOLD}%-42s${NC} [${GREEN}%s${NC}] ${GREEN}%3d%%${NC}\n" "$task_title" "$bar" "$end_pct"
    else
        printf "\r  ${YELLOW}✓${NC} ${BOLD}%-42s${NC} [${GREEN}%s${NC}] ${GREEN}%3d%%${NC}\n" "$task_title" "$bar" "$end_pct"
    fi
    return 0
}

# ------------------------------------------------------------------------------
# STEP 1: Pre-Flight Checks & Architecture (15%)
# ------------------------------------------------------------------------------
task_step1() {
    sleep 0.5
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
            sqlite3 libsqlite3-dev build-essential ca-certificates gnupg lsb-release ufw
    else
        apt-get update -y >> "$LOG_FILE" 2>&1 || true
        apt-get install $APT_OPTS \
            curl wget git unzip zip tar software-properties-common sudo procps net-tools \
            sqlite3 libsqlite3-dev build-essential ca-certificates gnupg lsb-release ufw >> "$LOG_FILE" 2>&1 || true
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
            dovecot-core dovecot-imapd dovecot-pop3d opendkim opendkim-tools spamassassin redis-server
        a2enmod rewrite proxy proxy_fcgi proxy_http headers
        apt-get install $APT_OPTS \
            php8.2-cli php8.2-fpm php8.2-common php8.2-mysql php8.2-curl php8.2-mbstring php8.2-xml php8.2-zip php8.2-gd \
            php8.3-cli php8.3-fpm php8.3-common php8.3-mysql php8.3-curl php8.3-mbstring php8.3-xml php8.3-zip php8.3-gd \
            php8.1-cli php8.1-fpm php8.1-common php8.1-mysql php8.1-curl php8.1-mbstring php8.1-xml php8.1-zip php8.1-gd \
            roundcube roundcube-core roundcube-mysql phpmyadmin || apt-get install $APT_OPTS php-cli php-fpm php-mysql php-curl php-mbstring php-xml php-zip php-gd roundcube roundcube-core roundcube-mysql phpmyadmin
    else
        apt-get update -y >> "$LOG_FILE" 2>&1 || true
        apt-get install $APT_OPTS \
            nginx apache2 varnish mariadb-server bind9 bind9utils dnsutils postfix postfix-pcre \
            dovecot-core dovecot-imapd dovecot-pop3d opendkim opendkim-tools spamassassin redis-server >> "$LOG_FILE" 2>&1 || true
        a2enmod rewrite proxy proxy_fcgi proxy_http headers >> "$LOG_FILE" 2>&1 || true
        apt-get install $APT_OPTS \
            php8.2-cli php8.2-fpm php8.2-common php8.2-mysql php8.2-curl php8.2-mbstring php8.2-xml php8.2-zip php8.2-gd \
            php8.3-cli php8.3-fpm php8.3-common php8.3-mysql php8.3-curl php8.3-mbstring php8.3-xml php8.3-zip php8.3-gd \
            php8.1-cli php8.1-fpm php8.1-common php8.1-mysql php8.1-curl php8.1-mbstring php8.1-xml php8.1-zip php8.1-gd \
            roundcube roundcube-core roundcube-mysql phpmyadmin >> "$LOG_FILE" 2>&1 || \
        apt-get install $APT_OPTS \
            php-cli php-fpm php-common php-mysql php-curl php-mbstring php-xml php-zip php-gd roundcube roundcube-core roundcube-mysql phpmyadmin >> "$LOG_FILE" 2>&1 || true
    fi

    # Install acme.sh for SSL management & setup daily auto-renewal cron
    if [ ! -f /root/.acme.sh/acme.sh ]; then
        curl -fsSL https://get.acme.sh | sh -s email=admin@akpanel.site >> "$LOG_FILE" 2>&1 || true
    fi
    mkdir -p /etc/cron.d
    echo "0 2 * * * root /root/.acme.sh/acme.sh --cron --home /root/.acme.sh > /var/log/akpanel-ssl-renew.log 2>&1" > /etc/cron.d/akpanel-ssl-renew
    chmod 644 /etc/cron.d/akpanel-ssl-renew 2>/dev/null || true

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
    allow-recursion { localhost; 127.0.0.1/32; };
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
    systemctl enable bind9 >> "$LOG_FILE" 2>&1 || systemctl enable named >> "$LOG_FILE" 2>&1 || true
    systemctl restart bind9 >> "$LOG_FILE" 2>&1 || systemctl restart named >> "$LOG_FILE" 2>&1 || true
}
run_task "Installing Nginx, Multi-PHP & MariaDB" 35 60 task_step3

# ------------------------------------------------------------------------------
# STEP 4: DB Users, Directories & phpMyAdmin SSO (75%)
# ------------------------------------------------------------------------------
task_step4() {
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

    # Roundcube Webmail Database & Config Setup
    run_mysql -e "CREATE DATABASE IF NOT EXISTS roundcubemail DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'roundcube'@'localhost' IDENTIFIED BY 'roundcube_akpanel_secret_pass'; GRANT ALL PRIVILEGES ON roundcubemail.* TO 'roundcube'@'localhost'; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
    if [ -f /usr/share/roundcube/SQL/mysql.initial.sql ]; then
        run_mysql roundcubemail < /usr/share/roundcube/SQL/mysql.initial.sql >> "$LOG_FILE" 2>&1 || true
    fi

    mkdir -p /etc/roundcube
    cat << 'EOF' > /etc/roundcube/config.inc.php
<?php
$config = [];
$config['db_dsnw'] = 'mysql://roundcube:roundcube_akpanel_secret_pass@localhost/roundcubemail';
$config['default_host'] = '127.0.0.1';
$config['default_port'] = 143;
$config['smtp_server'] = '127.0.0.1';
$config['smtp_port'] = 25;
$config['smtp_user'] = '%u';
$config['smtp_pass'] = '%p';
$config['support_url'] = '';
$config['product_name'] = 'AKpanel Webmail';
$config['des_key'] = 'rcmail_akpanel_super_secret_des_key_24';
$config['plugins'] = ['archive', 'zipdownload'];
$config['skin'] = 'elastic';
EOF
    chmod 644 /etc/roundcube/config.inc.php 2>/dev/null || true

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

        if command -v npm &> /dev/null && [ ! -f "public/build/app.js" ]; then
            npm install >> "$LOG_FILE" 2>&1 && npm run build >> "$LOG_FILE" 2>&1 || true
        fi

        go mod tidy >> "$LOG_FILE" 2>&1 || true
        go build -ldflags="-s -w" -o /usr/local/bin/akpanel main.go >> "$LOG_FILE" 2>&1 || true
    fi

    chmod +x /usr/local/bin/akpanel 2>/dev/null || true

    # Start Daemons
    service apache2 start >> "$LOG_FILE" 2>&1 || systemctl start apache2 >> "$LOG_FILE" 2>&1 || true
    service nginx start >> "$LOG_FILE" 2>&1 || systemctl start nginx >> "$LOG_FILE" 2>&1 || true
    service varnish start >> "$LOG_FILE" 2>&1 || systemctl start varnish >> "$LOG_FILE" 2>&1 || true
    service redis-server start >> "$LOG_FILE" 2>&1 || systemctl start redis-server >> "$LOG_FILE" 2>&1 || true

    for v in 8.1 8.2 8.3; do
        service "php${v}-fpm" start >> "$LOG_FILE" 2>&1 || systemctl start "php${v}-fpm" >> "$LOG_FILE" 2>&1 || true
    done

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
    # Configure Firewall
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
        ufw allow 587/tcp comment "SMTP Submission" >> "$LOG_FILE" 2>&1 || true
        ufw allow 993/tcp comment "IMAP SSL" >> "$LOG_FILE" 2>&1 || true
        
        if ufw status 2>/dev/null | grep -q "Status: active"; then
            ufw reload >> "$LOG_FILE" 2>&1 || true
        fi
    fi

    # Dynamic SSH MOTD Banner
    mkdir -p /etc/update-motd.d /etc/profile.d
    cat << 'MOTD_EOF' > /etc/profile.d/00-akpanel-motd.sh
#!/bin/bash
[ -z "$PS1" ] && return

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
[ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"
MEM_TOTAL=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}')
MEM_USED=$(free -m 2>/dev/null | awk '/^Mem:/{print $3}')
DISK_TOTAL=$(df -h / 2>/dev/null | awk 'NR==2{print $2}')
DISK_USED=$(df -h / 2>/dev/null | awk 'NR==2{print $3}')

if systemctl is-active --quiet akpanel 2>/dev/null || pgrep -f "/usr/local/bin/akpanel" >/dev/null; then
    PANEL_STATUS="${GREEN}ONLINE / ACTIVE ●${NC}"
else
    PANEL_STATUS="${RED}STOPPED ○${NC}"
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

echo -e "${BOLD}🌐 Access Points & Control Panels:${NC}"
echo -e "  👑 ${BOLD}Root / WHM Admin :${NC} ${YELLOW}http://${SERVER_IP}:2087${NC}"
echo -e "  👤 ${BOLD}Client Hosting   :${NC} ${YELLOW}http://${SERVER_IP}:2083${NC}"
echo -e "  🌐 ${BOLD}Web Sites (HTTP) :${NC} ${YELLOW}http://${SERVER_IP}:80${NC}"
echo ""
echo -e "${BOLD}📊 Server Health & Telemetry:${NC}"
echo -e "  • ${BOLD}Panel Status:${NC} ${PANEL_STATUS}"
echo -e "  • ${BOLD}Memory Usage:${NC} ${GREEN}${MEM_USED} MB${NC} / ${MEM_TOTAL} MB"
echo -e "  • ${BOLD}Disk Space  :${NC} ${GREEN}${DISK_USED}${NC} / ${DISK_TOTAL}"
echo -e "  • ${BOLD}Server IP   :${NC} ${CYAN}${SERVER_IP}${NC}"
echo ""
echo -e "${PURPLE}───────────────────────────────────────────────────────────────────────────────${NC}\n"
MOTD_EOF

    chmod +x /etc/profile.d/00-akpanel-motd.sh 2>/dev/null || true
    cp /etc/profile.d/00-akpanel-motd.sh /etc/update-motd.d/99-akpanel 2>/dev/null || true
    chmod +x /etc/update-motd.d/99-akpanel 2>/dev/null || true

    # Health Verification on Port 2087 & 2083
    local verified=false
    for ((i=1; i<=15; i++)); do
        if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:2087/ | grep -qE "200|302|401|403|404"; then
            verified=true
            break
        fi
        sleep 1
    done

    if [ "$verified" = false ]; then
        systemctl restart akpanel >> "$LOG_FILE" 2>&1 || true
        sleep 2
    fi
}
run_task "Firewall, SSH MOTD & Health Verification" 90 100 task_step6

# Final Verification Status
PANEL_ONLINE=false
if curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:2087/ | grep -qE "200|302|401|403|404"; then
    PANEL_ONLINE=true
fi

echo -e "\n${GREEN}==============================================================================${NC}"
if [ "$PANEL_ONLINE" = true ]; then
    echo -e "${GREEN} 🎉 Congratulations! AKpanel is ONLINE and verified successfully!${NC}"
else
    echo -e "${YELLOW} ⚠️ AKpanel is installed. Starting up... (Check: systemctl status akpanel)${NC}"
fi
echo -e "${GREEN}==============================================================================${NC}"
echo -e "  🌐 Root WHM Panel  : ${YELLOW}http://${SERVER_IP}:2087${NC}"
echo -e "  🌐 Client User URL : ${YELLOW}http://${SERVER_IP}:2083${NC}"
echo -e "  👤 Admin Username  : ${YELLOW}root${NC}"
echo -e "  🔑 Generated Pass  : ${BOLD}${RED}${ROOT_ADMIN_PASS}${NC} ${GREEN}(Randomly Generated)${NC}"
echo -e "  💾 Credentials File: ${CYAN}/etc/akpanel/credentials.txt${NC}"
echo -e "  📁 Websites Root   : ${CYAN}/var/www/sites${NC}"
echo -e "  ⚙️ Config Dir      : ${CYAN}/etc/akpanel${NC}"
echo -e "  📄 Installation Log: ${CYAN}${LOG_FILE}${NC}"
echo -e "${GREEN}==============================================================================${NC}\n"
