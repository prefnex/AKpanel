#!/usr/bin/env bash
# One-shot provisioning for the AKpanel dev container. Runs under systemd (PID 1), so the panel
# and every managed daemon are controlled through systemctl exactly as on a real VPS.
set -euo pipefail

export GOROOT=/usr/local/go GOPATH=/root/go
export HOME=/root GOCACHE=/root/.cache/go-build GOFLAGS=-buildvcs=false
export PATH=$GOROOT/bin:$GOPATH/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SRC=/root/AKpanel
log() { echo "[akpanel-dev] $*"; }

mkdir -p /var/log/akpanel /var/www/sites/default/public /etc/akpanel/ssl /etc/akpanel/secrets /run/php
chmod 700 /etc/akpanel/secrets

gen_secret() { # file length
    if [ ! -s "/etc/akpanel/secrets/$1" ]; then
        # Subshell without pipefail: tr is expected to die of SIGPIPE once head has enough.
        (set +o pipefail; LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$2") > "/etc/akpanel/secrets/$1"
    fi
    chmod 600 "/etc/akpanel/secrets/$1"
}
gen_secret mysql_root 24
gen_secret mysql_akpanel 24
gen_secret app_key 32
gen_secret admin_root 16

# ── MariaDB: password-protected TCP root + panel database ───────────────────
systemctl start mariadb
for _ in $(seq 1 30); do mysqladmin --protocol=socket ping --silent 2>/dev/null && break; sleep 1; done
ROOT_PASS=$(cat /etc/akpanel/secrets/mysql_root)
PANEL_PASS=$(cat /etc/akpanel/secrets/mysql_akpanel)
mysql --protocol=socket -u root <<SQL || true
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '${ROOT_PASS}';
ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '${ROOT_PASS}';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
DROP USER IF EXISTS 'ak_admin'@'%';
CREATE DATABASE IF NOT EXISTS akpanel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'akpanel'@'localhost' IDENTIFIED BY '${PANEL_PASS}';
CREATE USER IF NOT EXISTS 'akpanel'@'127.0.0.1' IDENTIFIED BY '${PANEL_PASS}';
GRANT ALL PRIVILEGES ON akpanel.* TO 'akpanel'@'localhost';
GRANT ALL PRIVILEGES ON akpanel.* TO 'akpanel'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

cat > /etc/akpanel/akpanel.env <<ENV
APP_ENV=local
APP_KEY=$(cat /etc/akpanel/secrets/app_key)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=akpanel
DB_USERNAME=akpanel
DB_PASSWORD=${PANEL_PASS}
ENV
chmod 600 /etc/akpanel/akpanel.env

# ── Web stack defaults (hybrid profile: Apache behind Nginx on 8081) ───────
[ -f /etc/akpanel/server_profile.conf ] || echo "hybrid_nginx_apache" > /etc/akpanel/server_profile.conf
sed -i 's/^Listen 80$/Listen 8081/' /etc/apache2/ports.conf 2>/dev/null || true
sed -i 's/<VirtualHost \*:80>/<VirtualHost *:8081>/' /etc/apache2/sites-available/000-default.conf 2>/dev/null || true
systemctl restart apache2 || true
systemctl restart nginx || true
if [ ! -f /etc/akpanel/install.conf ]; then
    cat > /etc/akpanel/install.conf <<'JSON'
{
  "hostname": "localhost",
  "admin_email": "admin@localhost",
  "panel": { "admin_port": 2087, "client_port": 2083 },
  "components": {
    "webserver_profile": "hybrid_nginx_apache",
    "php_versions": ["8.1", "8.2", "8.3"],
    "mariadb": true, "redis": true, "bind_dns": true, "mail_stack": true
  },
  "paths": { "sites_root": "/var/www/sites", "user_homes": "/home" }
}
JSON
fi

# ── Build ───────────────────────────────────────────────────────────────────
cd "$SRC"
if [ ! -f public/build/app.js ]; then
    log "building frontend"
    npm install --prefer-offline --no-audit --no-fund
    npm run build
fi
log "building backend"
go build -o /usr/local/bin/akpanel main.go

# ── Panel service (same shape as the production unit written by install.sh) ─
cat > /etc/systemd/system/akpanel.service <<UNIT
[Unit]
Description=AKpanel Hosting Control Panel
After=network.target nginx.service mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=${SRC}
ExecStart=/usr/local/bin/akpanel
Restart=always
RestartSec=3
EnvironmentFile=-/etc/akpanel/akpanel.env
StandardOutput=append:/var/log/akpanel/output.log
StandardError=append:/var/log/akpanel/output.log

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable cron >/dev/null 2>&1 || true
systemctl start cron || true
/usr/local/bin/akpanel --bootstrap-services || log "bootstrap reported warnings (see journal)"
systemctl enable akpanel >/dev/null 2>&1
systemctl restart akpanel

for _ in $(seq 1 60); do
    curl -sk -o /dev/null https://127.0.0.1:2087/ && break
    sleep 1
done
log "ready → https://localhost:2087 (admin) · https://localhost:2083 (client)"
log "initial root password: /etc/akpanel/secrets/admin_root (only used if root.auth did not exist)"
