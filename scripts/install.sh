#!/usr/bin/env bash
# ==============================================================================
#  🚀 AKpanel - Official High-Performance Linux Hosting Panel Installer
# ==============================================================================

set -e

# Default settings
DEFAULT_REPO="prefnex/AKpanel"
GITHUB_REPO="${AKPANEL_REPO:-$DEFAULT_REPO}"
DEFAULT_VERSION="v0.1.0"
INSTALL_DIR="/opt/akpanel"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${PURPLE}"
cat << "EOF"
    _    _  ______                  _ 
   / \  | |/ /  _ \ __ _ _ __   ___| |
  / _ \ | ' /| |_) / _` | '_ \ / _ \ |
 / ___ \| . \|  __/ (_| | | | |  __/ |
/_/   \_\_|\_\_|   \__,_|_| |_|\___|_|
                                      
  Next-Gen High Performance Cloud Hosting Control Panel
EOF
echo -e "${NC}"

# 1. Check Root Privileges
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${RED}❌ Error: This script must be run as root!${NC}"
    echo "Please re-run using: sudo bash $0"
    exit 1
fi

echo -e "${CYAN}▶ [1/6] Pre-flight system checks...${NC}"
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
[ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"
echo -e "  Detected Server IP: ${GREEN}${SERVER_IP}${NC}"

# Detect Architecture
ARCH=$(uname -m)
case "$ARCH" in
    x86_64|amd64)
        PKG_ARCH="amd64"
        ;;
    aarch64|arm64)
        PKG_ARCH="arm64"
        ;;
    *)
        echo -e "${YELLOW}⚠️ Architecture $ARCH detected, defaulting to amd64 binary.${NC}"
        PKG_ARCH="amd64"
        ;;
esac
echo -e "  Architecture: ${GREEN}${PKG_ARCH}${NC}"

# 2. Update System and Install Core Utilities
export DEBIAN_FRONTEND=noninteractive

if dpkg -s nginx mariadb-server phpmyadmin php8.1-cli bind9 &>/dev/null; then
    echo -e "\n${GREEN}⚡ [2/6 & 3/6] Pre-installed / cached stack detected!${NC}"
    echo -e "  ${GREEN}✓ Skipping APT packages download (instant bootstrap).${NC}"
else
    echo -e "\n${CYAN}▶ [2/6] Updating APT repositories & installing core tools...${NC}"
    apt-get update -y
    apt-get install -y \
        curl \
        wget \
        git \
        unzip \
        zip \
        tar \
        software-properties-common \
        sudo \
        procps \
        net-tools \
        sqlite3 \
        libsqlite3-dev \
        build-essential \
        ca-certificates

    # 3. Install Web Server Engines, DNS, Mail, Multi-PHP & MariaDB
    echo -e "\n${CYAN}▶ [3/6] Installing Nginx, Apache2, Varnish, BIND9, Postfix, Dovecot, Multi-PHP & MariaDB...${NC}"
    apt-get install -y nginx apache2 varnish mariadb-server bind9 bind9utils bind9-doc dnsutils postfix postfix-pcre dovecot-core dovecot-imapd dovecot-pop3d opendkim opendkim-tools spamassassin redis-server || true
    a2enmod rewrite proxy proxy_fcgi proxy_http headers 2>/dev/null || true

    # Add PHP PPA
    LC_ALL=C.UTF-8 add-apt-repository -y ppa:ondrej/php || true
    apt-get update -y

    # Install Multi-PHP (8.1, 8.2, 8.3) with database extensions & phpMyAdmin
    apt-get install -y \
        php8.1-cli php8.1-fpm php8.1-common php8.1-mysql php8.1-curl php8.1-mbstring php8.1-xml php8.1-zip php8.1-gd \
        php8.2-cli php8.2-fpm php8.2-common php8.2-mysql php8.2-curl php8.2-mbstring php8.2-xml php8.2-zip php8.2-gd \
        php8.3-cli php8.3-fpm php8.3-common php8.3-mysql php8.3-curl php8.3-mbstring php8.3-xml php8.3-zip php8.3-gd \
        phpmyadmin || true
fi

# Configure default MariaDB ak_admin user
service mariadb start 2>/dev/null || service mysql start 2>/dev/null || true
sleep 1

run_mysql() {
    mysql -u root -pakpanel123 "$@" 2>/dev/null || mysql -u root "$@" 2>/dev/null || mysql "$@" 2>/dev/null || true
}

run_mysql -e "CREATE USER IF NOT EXISTS 'ak_admin'@'%' IDENTIFIED BY 'akpanel123'; GRANT ALL PRIVILEGES ON *.* TO 'ak_admin'@'%' WITH GRANT OPTION; FLUSH PRIVILEGES;"
run_mysql -e "CREATE USER IF NOT EXISTS 'ak_admin'@'localhost' IDENTIFIED BY 'akpanel123'; GRANT ALL PRIVILEGES ON *.* TO 'ak_admin'@'localhost' WITH GRANT OPTION; FLUSH PRIVILEGES;"
run_mysql -e "CREATE USER IF NOT EXISTS 'ak_admin'@'127.0.0.1' IDENTIFIED BY 'akpanel123'; GRANT ALL PRIVILEGES ON *.* TO 'ak_admin'@'127.0.0.1' WITH GRANT OPTION; FLUSH PRIVILEGES;"
run_mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY 'akpanel123'; FLUSH PRIVILEGES;"

# Configure phpMyAdmin Storage Database & Single Sign-On (SSO)
run_mysql -e "CREATE DATABASE IF NOT EXISTS phpmyadmin DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'pma'@'localhost' IDENTIFIED BY 'pma_akpanel_secret_pass'; GRANT ALL PRIVILEGES ON phpmyadmin.* TO 'pma'@'localhost'; CREATE USER IF NOT EXISTS 'phpmyadmin'@'localhost' IDENTIFIED BY 'pma_akpanel_secret_pass'; GRANT ALL PRIVILEGES ON phpmyadmin.* TO 'phpmyadmin'@'localhost'; FLUSH PRIVILEGES;"
if [ -f /usr/share/phpmyadmin/sql/create_tables.sql ]; then
    run_mysql phpmyadmin < /usr/share/phpmyadmin/sql/create_tables.sql 2>/dev/null || true
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
$cfg['Servers'][1]['bookmarktable'] = 'pma__bookmark';
$cfg['Servers'][1]['relation'] = 'pma__relation';
$cfg['Servers'][1]['table_info'] = 'pma__table_info';
$cfg['Servers'][1]['table_coords'] = 'pma__table_coords';
$cfg['Servers'][1]['pdf_pages'] = 'pma__pdf_pages';
$cfg['Servers'][1]['column_info'] = 'pma__column_info';
$cfg['Servers'][1]['history'] = 'pma__history';
$cfg['Servers'][1]['table_uiprefs'] = 'pma__table_uiprefs';
$cfg['Servers'][1]['tracking'] = 'pma__tracking';
$cfg['Servers'][1]['userconfig'] = 'pma__userconfig';
$cfg['Servers'][1]['recent'] = 'pma__recent';
$cfg['Servers'][1]['favorite'] = 'pma__favorite';
$cfg['Servers'][1]['users'] = 'pma__users';
$cfg['Servers'][1]['usergroups'] = 'pma__usergroups';
$cfg['Servers'][1]['navigationhiding'] = 'pma__navigationhiding';
$cfg['Servers'][1]['savedsearches'] = 'pma__savedsearches';
$cfg['Servers'][1]['central_columns'] = 'pma__central_columns';
$cfg['Servers'][1]['designer_settings'] = 'pma__designer_settings';
$cfg['Servers'][1]['export_templates'] = 'pma__export_templates';
$cfg['Servers'][1]['SessionTimeToLive'] = 86400;

$cfg['PmaNoRelation_DisableWarning'] = true;
$cfg['ServerLibraryDifference_DisableWarning'] = true;
$cfg['SessionSavePath'] = '/var/lib/phpmyadmin/sessions';
$cfg['CookieSameSite'] = 'Lax';
$cfg['CookieSecure'] = false;
$cfg['CookiePath'] = '/';
$cfg['VersionCheck'] = false;
$cfg['SendErrorReports'] = 'never';
$cfg['CheckConfigurationPermissions'] = false;
$cfg['LoginCookieValidity'] = 86400;
$cfg['LoginCookieValidityDisableWarning'] = true;
$cfg['ExecTimeLimit'] = 300;
EOF

# Sync session.gc_maxlifetime in PHP INIs
for ini in /etc/php/*/cli/php.ini /etc/php/*/fpm/php.ini; do
    if [ -f "$ini" ]; then
        sed -i 's/^session.gc_maxlifetime = .*/session.gc_maxlifetime = 86400/' "$ini" 2>/dev/null || true
    fi
done

# phpMyAdmin Single Sign-On PHP Handler
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

// Clear any failed/stale session to avoid loop
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

# 4. Setup AKpanel Directories
echo -e "\n${CYAN}▶ [4/6] Setting up AKpanel directory structures...${NC}"
mkdir -p /etc/akpanel /var/www/sites /var/log/akpanel /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/bind/zones /etc/opendkim/keys /var/vmail "$INSTALL_DIR"
chmod 700 /etc/opendkim/keys 2>/dev/null || true
chmod 755 /var/vmail 2>/dev/null || true

# Setup default placeholder site
mkdir -p /var/www/sites/default/public
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
        <p>Nginx and Multi-PHP are running smoothly on your Ubuntu 22.04 server.</p>
        <p>You can manage websites and databases from your <strong>AKpanel Dashboard</strong>.</p>
    </div>
</body>
</html>
HTML

chown -R www-data:www-data /var/www/sites 2>/dev/null || true

# 5. Fetch & Install AKpanel Application
echo -e "\n${CYAN}▶ [5/6] Deploying AKpanel application...${NC}"

INSTALLED_FROM_RELEASE=false

# Case A: Local development repository detected
if [ -f "$(pwd)/main.go" ] && [ -f "$(pwd)/go.mod" ]; then
    echo -e "  ${GREEN}✓ Local repository detected at $(pwd). Using local source.${NC}"
    PROJECT_ROOT="$(pwd)"
elif [ -d "/root/AKpanel" ] && [ -f "/root/AKpanel/main.go" ]; then
    PROJECT_ROOT="/root/AKpanel"
else
    # Case B: Download pre-built release package from GitHub
    echo "  Resolving latest release package from GitHub..."
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
    
    echo "  Downloading ${RELEASE_TAR} (${TARGET_TAG})..."
    TEMP_DIR=$(mktemp -d)
    if curl -sSL -f "$DOWNLOAD_URL" -o "${TEMP_DIR}/${RELEASE_TAR}" 2>/dev/null; then
        echo -e "  ${GREEN}✓ Downloaded official release bundle successfully.${NC}"
        mkdir -p "$INSTALL_DIR"
        tar -xzf "${TEMP_DIR}/${RELEASE_TAR}" -C "$INSTALL_DIR"
        rm -rf "$TEMP_DIR"
        PROJECT_ROOT="$INSTALL_DIR"
        INSTALLED_FROM_RELEASE=true
    else
        echo -e "  ${YELLOW}⚠️ Release bundle download unavailable. Falling back to Git clone...${NC}"
        mkdir -p "$INSTALL_DIR"
        git clone "https://github.com/${GITHUB_REPO}.git" "$INSTALL_DIR" 2>/dev/null || true
        PROJECT_ROOT="$INSTALL_DIR"
    fi
fi

cd "$PROJECT_ROOT"

# Ensure binary is in place
if [ -f "$PROJECT_ROOT/akpanel" ]; then
    cp "$PROJECT_ROOT/akpanel" /usr/local/bin/akpanel
    chmod +x /usr/local/bin/akpanel
elif [ -f "$PROJECT_ROOT/akpanel-bin" ]; then
    cp "$PROJECT_ROOT/akpanel-bin" /usr/local/bin/akpanel
    chmod +x /usr/local/bin/akpanel
else
    # Build from source if binary is not present
    if ! command -v go &> /dev/null; then
        echo "  Installing Go runtime for compilation..."
        wget -q https://go.dev/dl/go1.23.6.linux-amd64.tar.gz
        tar -C /usr/local -xzf go1.23.6.linux-amd64.tar.gz
        rm -f go1.23.6.linux-amd64.tar.gz
        export PATH="/usr/local/go/bin:${PATH}"
    fi

    if command -v npm &> /dev/null && [ ! -f "public/build/app.js" ]; then
        echo "  Building React frontend with Vite..."
        npm install && npm run build || true
    fi

    echo "  Compiling AKpanel Go binary..."
    go mod tidy 2>/dev/null || true
    go build -ldflags="-s -w" -o /usr/local/bin/akpanel main.go
fi

chmod +x /usr/local/bin/akpanel

# 6. Setup Systemd Service & Start All Daemons
echo -e "\n${CYAN}▶ [6/6] Starting system services (Nginx, Apache, PHP, Systemd)...${NC}"

# Configure Apache port 8081
echo "Listen 8081" > /etc/apache2/ports.conf 2>/dev/null || true
echo "ServerName localhost" >> /etc/apache2/apache2.conf 2>/dev/null || true
service apache2 start 2>/dev/null || true

# Start Web Server & Cache
service nginx start 2>/dev/null || nginx 2>/dev/null || true
service varnish start 2>/dev/null || true
service redis-server start 2>/dev/null || true

# Start PHP-FPM
service php8.1-fpm start 2>/dev/null || true
service php8.2-fpm start 2>/dev/null || true
service php8.3-fpm start 2>/dev/null || true

# Configure UFW Firewall on VPS if active
if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
    echo "  Opening firewall ports for AKpanel & services..."
    ufw allow 2087/tcp comment "AKpanel Root WHM" 2>/dev/null || true
    ufw allow 2083/tcp comment "AKpanel Client Portal" 2>/dev/null || true
    ufw allow 80/tcp comment "HTTP Web" 2>/dev/null || true
    ufw allow 443/tcp comment "HTTPS SSL" 2>/dev/null || true
    ufw allow 21/tcp comment "FTP" 2>/dev/null || true
    ufw allow 53 comment "DNS" 2>/dev/null || true
    ufw allow 25/tcp comment "SMTP Mail" 2>/dev/null || true
    ufw allow 587/tcp comment "SMTP Submission" 2>/dev/null || true
    ufw allow 993/tcp comment "IMAP SSL" 2>/dev/null || true
fi

# Create Systemd service
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

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload 2>/dev/null || true
    systemctl enable akpanel 2>/dev/null || true
    systemctl restart akpanel 2>/dev/null || true
fi

# Ensure background daemon is active if systemctl not present (e.g. docker container)
if ! pgrep -f "/usr/local/bin/akpanel" > /dev/null; then
    echo "  Starting AKpanel daemon in background on port 2087 & 2083..."
    cd "$PROJECT_ROOT"
    nohup /usr/local/bin/akpanel > /var/log/akpanel/output.log 2>&1 &
    sleep 2
fi

echo -e "\n${GREEN}==============================================================================${NC}"
echo -e "${GREEN} 🎉 Congratulations! AKpanel has been installed successfully!${NC}"
echo -e "${GREEN}==============================================================================${NC}"
echo -e "  🌐 Root WHM Panel  : ${YELLOW}http://${SERVER_IP}:2087${NC}"
echo -e "  🌐 Client User URL : ${YELLOW}http://${SERVER_IP}:2083${NC}"
echo -e "  👤 Default User    : ${YELLOW}root${NC}"
echo -e "  🔑 Default Pass    : ${YELLOW}admin123456${NC}"
echo -e "  📁 Websites Root   : ${CYAN}/var/www/sites${NC}"
echo -e "  ⚙️ Config Dir      : ${CYAN}/etc/akpanel${NC}"
echo -e "  📄 Output Logs     : ${CYAN}/var/log/akpanel/output.log${NC}"
echo -e "${GREEN}==============================================================================${NC}\n"
