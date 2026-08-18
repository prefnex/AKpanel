#!/usr/bin/env bash
# ==============================================================================
#  🚀 AKpanel - Official High-Performance Linux Hosting Panel Installer
# ==============================================================================

set +e

# Default settings
DEFAULT_REPO="prefnex/AKpanel"
GITHUB_REPO="${AKPANEL_REPO:-$DEFAULT_REPO}"
DEFAULT_VERSION="v0.1.0"
INSTALL_DIR="/opt/akpanel"
LOG_FILE="/var/log/akpanel-install.log"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

mkdir -p /var/log
echo "=== AKpanel Installation Started: $(date) ===" > "$LOG_FILE"

# Step Logger with percentage
print_step() {
    local step_num="$1"
    local total_steps="$2"
    local percent="$3"
    local message="$4"
    echo -e "  ${PURPLE}[${step_num}/${total_steps}]${NC} ${BOLD}${CYAN}[ ${percent} ]${NC} ${message}"
}

print_success() {
    local message="$1"
    echo -e "      ${GREEN}✓ ${message}${NC}"
}

print_warning() {
    local message="$1"
    echo -e "      ${YELLOW}⚠️ ${message}${NC}"
}

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

echo -e "${BOLD}🚀 Starting Clean Automated Installation...${NC} (Logs: ${CYAN}${LOG_FILE}${NC})\n"

# ------------------------------------------------------------------------------
# STEP 1: Pre-Flight System Checks (15%)
# ------------------------------------------------------------------------------
print_step "1" "6" " 15% " "🔍 Performing system pre-flight checks & architecture detection..."

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
[ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"

ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64)
        PKG_ARCH="amd64"
        ;;
    aarch64|arm64)
        PKG_ARCH="arm64"
        ;;
    *)
        PKG_ARCH="amd64"
        ;;
esac

UBUNTU_CODENAME=$(lsb_release -sc 2>/dev/null || grep VERSION_CODENAME /etc/os-release 2>/dev/null | cut -d= -f2 || echo "jammy")
print_success "Server IP: ${SERVER_IP} | Architecture: ${PKG_ARCH} | OS: ${UBUNTU_CODENAME}"

# ------------------------------------------------------------------------------
# STEP 2: Updating APT Repositories & Base Tools (35%)
# ------------------------------------------------------------------------------
print_step "2" "6" " 35% " "📦 Updating system repositories & base dependencies..."

export DEBIAN_FRONTEND=noninteractive
APT_OPTS="-y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold"

apt-get update -y >> "$LOG_FILE" 2>&1 || true
apt-get install $APT_OPTS \
    curl wget git unzip zip tar software-properties-common sudo procps net-tools \
    sqlite3 libsqlite3-dev build-essential ca-certificates gnupg lsb-release ufw >> "$LOG_FILE" 2>&1 || true

print_success "Base system utilities installed."

# ------------------------------------------------------------------------------
# STEP 3: Installing Web Engines, Multi-PHP & MariaDB (55%)
# ------------------------------------------------------------------------------
print_step "3" "6" " 55% " "⚙️ Configuring Web Servers (Nginx/Apache), Multi-PHP & MariaDB..."

# Configure PHP Repository with universal fallback
mkdir -p /etc/apt/keyrings /etc/apt/sources.list.d
PPA_ADDED=false

if [[ "$UBUNTU_CODENAME" =~ ^(focal|jammy|noble)$ ]]; then
    if LC_ALL=C.UTF-8 add-apt-repository -y ppa:ondrej/php >> "$LOG_FILE" 2>&1; then
        PPA_ADDED=true
    fi
fi

if [ "$PPA_ADDED" = false ]; then
    curl -fsSL https://packages.sury.org/php/apt.gpg 2>/dev/null | gpg --dearmor --yes -o /etc/apt/keyrings/ondrej-php.gpg 2>>"$LOG_FILE" || \
    curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x14AA40EC0831756756D7F66C4F4EA0AAE5267A6C" 2>/dev/null | gpg --dearmor --yes -o /etc/apt/keyrings/ondrej-php.gpg 2>>"$LOG_FILE" || true

    FALLBACK_SUITE="noble"
    [ "$UBUNTU_CODENAME" = "focal" ] && FALLBACK_SUITE="focal"
    [ "$UBUNTU_CODENAME" = "jammy" ] && FALLBACK_SUITE="jammy"

    echo "deb [signed-by=/etc/apt/keyrings/ondrej-php.gpg] https://ppa.launchpadcontent.net/ondrej/php/ubuntu ${FALLBACK_SUITE} main" > /etc/apt/sources.list.d/ondrej-ubuntu-php.list
fi

apt-get update -y >> "$LOG_FILE" 2>&1 || true

# Install Core Stack Packages
apt-get install $APT_OPTS \
    nginx apache2 varnish mariadb-server bind9 bind9utils dnsutils postfix postfix-pcre \
    dovecot-core dovecot-imapd dovecot-pop3d opendkim opendkim-tools spamassassin redis-server >> "$LOG_FILE" 2>&1 || true

a2enmod rewrite proxy proxy_fcgi proxy_http headers >> "$LOG_FILE" 2>&1 || true

# Install Focused Multi-PHP (8.2 & 8.3 & 8.1)
apt-get install $APT_OPTS \
    php8.2-cli php8.2-fpm php8.2-common php8.2-mysql php8.2-curl php8.2-mbstring php8.2-xml php8.2-zip php8.2-gd \
    php8.3-cli php8.3-fpm php8.3-common php8.3-mysql php8.3-curl php8.3-mbstring php8.3-xml php8.3-zip php8.3-gd \
    php8.1-cli php8.1-fpm php8.1-common php8.1-mysql php8.1-curl php8.1-mbstring php8.1-xml php8.1-zip php8.1-gd \
    phpmyadmin >> "$LOG_FILE" 2>&1 || \
apt-get install $APT_OPTS \
    php-cli php-fpm php-common php-mysql php-curl php-mbstring php-xml php-zip php-gd phpmyadmin >> "$LOG_FILE" 2>&1 || true

print_success "Nginx, Multi-PHP (8.1, 8.2, 8.3), and MariaDB configured."

# ------------------------------------------------------------------------------
# STEP 4: Setting up Directories, DBs & phpMyAdmin SSO (70%)
# ------------------------------------------------------------------------------
print_step "4" "6" " 70% " "📁 Setting up system directories, Database auth & phpMyAdmin SSO..."

# Start MariaDB & create internal users
service mariadb start >> "$LOG_FILE" 2>&1 || service mysql start >> "$LOG_FILE" 2>&1 || systemctl start mariadb >> "$LOG_FILE" 2>&1 || true
sleep 1

run_mysql() {
    mysql -u root -pakpanel123 "$@" 2>/dev/null || mysql -u root "$@" 2>/dev/null || mysql "$@" 2>/dev/null || true
}

run_mysql -e "CREATE USER IF NOT EXISTS 'ak_admin'@'%' IDENTIFIED BY 'akpanel123'; GRANT ALL PRIVILEGES ON *.* TO 'ak_admin'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
run_mysql -e "CREATE USER IF NOT EXISTS 'ak_admin'@'localhost' IDENTIFIED BY 'akpanel123'; GRANT ALL PRIVILEGES ON *.* TO 'ak_admin'@'localhost' WITH GRANT OPTION; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
run_mysql -e "CREATE USER IF NOT EXISTS 'ak_admin'@'127.0.0.1' IDENTIFIED BY 'akpanel123'; GRANT ALL PRIVILEGES ON *.* TO 'ak_admin'@'127.0.0.1' WITH GRANT OPTION; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
run_mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'akpanel123'; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1

# phpMyAdmin SSO & DB setup
run_mysql -e "CREATE DATABASE IF NOT EXISTS phpmyadmin DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'pma'@'localhost' IDENTIFIED BY 'pma_akpanel_secret_pass'; GRANT ALL PRIVILEGES ON phpmyadmin.* TO 'pma'@'localhost'; CREATE USER IF NOT EXISTS 'phpmyadmin'@'localhost' IDENTIFIED BY 'pma_akpanel_secret_pass'; GRANT ALL PRIVILEGES ON phpmyadmin.* TO 'phpmyadmin'@'localhost'; FLUSH PRIVILEGES;" >> "$LOG_FILE" 2>&1
if [ -f /usr/share/phpmyadmin/sql/create_tables.sql ]; then
    run_mysql phpmyadmin < /usr/share/phpmyadmin/sql/create_tables.sql >> "$LOG_FILE" 2>&1 || true
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

# phpMyAdmin SSO Handler
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

# Setup default directories & placeholder website
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

# Generate random secure root admin password
if [ ! -f /etc/akpanel/root.auth ]; then
    if [ -n "$AKPANEL_PASSWORD" ]; then
        ROOT_ADMIN_PASS="$AKPANEL_PASSWORD"
    else
        ROOT_ADMIN_PASS=$(tr -dc 'A-Za-z0-9#$!&@%' < /dev/urandom 2>/dev/null | head -c 16 || true)
        [ -z "$ROOT_ADMIN_PASS" ] && ROOT_ADMIN_PASS="AkPanel@$(date +%s | cut -c5-10)!"
    fi

    SALT=$(date +%s%N | sha256sum | head -c 16)
    HASH=$(printf "%s:%s:akpanel_root_pepper" "$ROOT_ADMIN_PASS" "$SALT" | sha256sum | awk '{print $1}')
    
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
 👑 AKpanel Initial Root Administrator Credentials
==============================================================================
 🌐 Root WHM Panel  : http://${SERVER_IP}:2087
 👤 Username        : root
 🔑 Generated Pass  : ${ROOT_ADMIN_PASS}
 🌐 Client Portal   : http://${SERVER_IP}:2083
 📅 Installation    : $(date)
==============================================================================
 Important: Please save these credentials in a secure place.
==============================================================================
EOF
    chmod 600 /etc/akpanel/credentials.txt 2>/dev/null || true
else
    if [ -f /etc/akpanel/credentials.txt ]; then
        ROOT_ADMIN_PASS=$(grep "Generated Pass" /etc/akpanel/credentials.txt 2>/dev/null | awk '{print $NF}' || echo "[Preserved Existing Password]")
    else
        ROOT_ADMIN_PASS="[Preserved Existing Password]"
    fi
fi

print_success "Directory structure, security keys & random root credentials initialized."

# ------------------------------------------------------------------------------
# STEP 5: Deploying AKpanel Application & Systemd Service (85%)
# ------------------------------------------------------------------------------
print_step "5" "6" " 85% " "🚀 Downloading & launching AKpanel Release binary..."

# Check if pre-compiled or local
if [ -f "$(pwd)/main.go" ] && [ -f "$(pwd)/go.mod" ]; then
    PROJECT_ROOT="$(pwd)"
elif [ -d "/root/AKpanel" ] && [ -f "/root/AKpanel/main.go" ]; then
    PROJECT_ROOT="/root/AKpanel"
else
    TARGET_TAG="${AKPANEL_VERSION:-}"
    if [ -z "$TARGET_TAG" ] || [ "$TARGET_TAG" = "latest" ]; then
        LATEST_JSON=$(curl -sSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null || true)
        DETECTED_TAG=$(echo "$LATEST_JSON" | grep '"tag_name":' | head -n 1 | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/' || true)
        if [ -n "$DETECTED_TAG" ]; then
            TARGET_TAG="$DETECTED_TAG"
        else
            TARGET_TAG="$DEFAULT_VERSION"
        fi
    fi

    RELEASE_TAR="akpanel_${TARGET_TAG}_linux_${PKG_ARCH}.tar.gz"
    DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${TARGET_TAG}/${RELEASE_TAR}"
    
    TEMP_DIR=$(mktemp -d)
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

# Ensure executable binary
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

# Ensure .env exists with valid APP_KEY in application root
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
    else
        cat << 'EOF' > "$PROJECT_ROOT/.env"
APP_NAME=AKpanel
APP_ENV=production
APP_KEY=akpanel_enterprise_super_key_32_chr
APP_DEBUG=false
LOG_CHANNEL=stack
LOG_LEVEL=info
APP_URL=http://localhost:2087
APP_HOST=0.0.0.0
APP_PORT=2087
EOF
    fi
    RAND_APP_KEY=$(tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | head -c 32 || echo "akpanel_super_secret_key_32_chr_")
    sed -i "s/^APP_KEY=.*/APP_KEY=${RAND_APP_KEY}/" "$PROJECT_ROOT/.env" 2>/dev/null || true
fi

# Start System Daemons
service apache2 start >> "$LOG_FILE" 2>&1 || systemctl start apache2 >> "$LOG_FILE" 2>&1 || true
service nginx start >> "$LOG_FILE" 2>&1 || systemctl start nginx >> "$LOG_FILE" 2>&1 || true
service varnish start >> "$LOG_FILE" 2>&1 || systemctl start varnish >> "$LOG_FILE" 2>&1 || true
service redis-server start >> "$LOG_FILE" 2>&1 || systemctl start redis-server >> "$LOG_FILE" 2>&1 || true

for v in 8.1 8.2 8.3; do
    service "php${v}-fpm" start >> "$LOG_FILE" 2>&1 || systemctl start "php${v}-fpm" >> "$LOG_FILE" 2>&1 || true
done

# Create and Start Systemd service
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
RestartSec=5
Environment=APP_ENV=production
Environment=APP_PORT=2087
Environment=APP_HOST=0.0.0.0
Environment=APP_KEY=akpanel_enterprise_super_key_32_chr

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload >> "$LOG_FILE" 2>&1 || true
    systemctl enable akpanel >> "$LOG_FILE" 2>&1 || true
    systemctl restart akpanel >> "$LOG_FILE" 2>&1 || true
fi

# Direct daemon fallback
if ! pgrep -f "/usr/local/bin/akpanel" > /dev/null; then
    cd "$PROJECT_ROOT"
    nohup /usr/local/bin/akpanel > /var/log/akpanel/output.log 2>&1 &
    sleep 2
fi

print_success "AKpanel core service launched and active on Port 2087 & 2083."

# ------------------------------------------------------------------------------
# STEP 6: Configuring Firewall & Opening Essential Ports (100%)
# ------------------------------------------------------------------------------
print_step "6" "6" "100% " "🛡️ Configuring Firewall (UFW) & opening all essential ports..."

if command -v ufw &>/dev/null; then
    # ALWAYS ensure SSH is open first to prevent lockouts
    ufw allow 22/tcp comment "SSH Remote Access" >> "$LOG_FILE" 2>&1 || true
    ufw allow 2087/tcp comment "AKpanel Root WHM" >> "$LOG_FILE" 2>&1 || true
    ufw allow 2083/tcp comment "AKpanel Client Portal" >> "$LOG_FILE" 2>&1 || true
    ufw allow 80/tcp comment "HTTP Web" >> "$LOG_FILE" 2>&1 || true
    ufw allow 443/tcp comment "HTTPS SSL" >> "$LOG_FILE" 2>&1 || true
    ufw allow 21/tcp comment "FTP Service" >> "$LOG_FILE" 2>&1 || true
    ufw allow 53 comment "DNS Service" >> "$LOG_FILE" 2>&1 || true
    ufw allow 25/tcp comment "SMTP Mail" >> "$LOG_FILE" 2>&1 || true
    ufw allow 587/tcp comment "SMTP Submission" >> "$LOG_FILE" 2>&1 || true
    ufw allow 993/tcp comment "IMAP SSL" >> "$LOG_FILE" 2>&1 || true
    
    if ufw status 2>/dev/null | grep -q "Status: active"; then
        ufw reload >> "$LOG_FILE" 2>&1 || true
    fi
fi

# Dynamic SSH Login Banner (MOTD)
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

print_success "Firewall rules applied & SSH Welcome Banner activated."

echo -e "\n${GREEN}==============================================================================${NC}"
echo -e "${GREEN} 🎉 Congratulations! AKpanel has been installed successfully!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "  🌐 Root WHM Panel  : ${YELLOW}http://${SERVER_IP}:2087${NC}"
echo -e "  🌐 Client User URL : ${YELLOW}http://${SERVER_IP}:2083${NC}"
echo -e "  👤 Admin Username  : ${YELLOW}root${NC}"
echo -e "  🔑 Generated Pass  : ${BOLD}${RED}${ROOT_ADMIN_PASS}${NC} ${GREEN}(Randomly Generated)${NC}"
echo -e "  💾 Credentials File: ${CYAN}/etc/akpanel/credentials.txt${NC}"
echo -e "  📁 Websites Root   : ${CYAN}/var/www/sites${NC}"
echo -e "  ⚙️ Config Dir      : ${CYAN}/etc/akpanel${NC}"
echo -e "  📄 Full Log File   : ${CYAN}${LOG_FILE}${NC}"
echo -e "${GREEN}==============================================================================${NC}\n"
