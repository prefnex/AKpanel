FROM ubuntu:22.04

LABEL maintainer="AKpanel Team"
LABEL description="AKpanel Enterprise Full-Stack Linux Hosting VPS Environment"

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=UTC

# ── Step 1: Core base utilities ──────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    sudo \
    bash \
    procps \
    iproute2 \
    net-tools \
    ca-certificates \
    gnupg \
    lsb-release \
    systemd \
    systemd-sysv \
    cron \
    unzip \
    zip \
    tar \
    sqlite3 \
    libsqlite3-dev \
    build-essential \
    software-properties-common \
    && rm -rf /var/lib/apt/lists/*

# ── Step 2: Node.js 20 LTS (for npm run build) ───────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── Step 3: Go 1.23.6 (for go build inside container) ───────────────────────
ENV GOROOT=/usr/local/go
ENV GOPATH=/root/go
ENV PATH=$GOROOT/bin:$GOPATH/bin:$PATH

RUN ARCH=$(dpkg --print-architecture) \
    && wget -q "https://go.dev/dl/go1.23.6.linux-${ARCH}.tar.gz" -O /tmp/go.tar.gz \
    && tar -C /usr/local -xzf /tmp/go.tar.gz \
    && rm /tmp/go.tar.gz

# ── Step 4: Web stack + PHP (PPA required) ───────────────────────────────────
RUN LC_ALL=C.UTF-8 add-apt-repository -y ppa:ondrej/php \
    && apt-get update \
    && apt-get install -y \
    mariadb-server \
    mariadb-client \
    postgresql \
    postgresql-contrib \
    redis-server \
    nginx \
    apache2 \
    varnish \
    bind9 \
    bind9utils \
    bind9-doc \
    dnsutils \
    postfix \
    postfix-pcre \
    dovecot-core \
    dovecot-imapd \
    dovecot-pop3d \
    opendkim \
    opendkim-tools \
    spamassassin \
    pure-ftpd \
    php8.1-cli php8.1-fpm php8.1-mysql php8.1-mbstring php8.1-xml php8.1-curl php8.1-zip php8.1-gd \
    php8.2-cli php8.2-fpm php8.2-mysql php8.2-mbstring php8.2-xml php8.2-curl php8.2-zip php8.2-gd \
    php8.3-cli php8.3-fpm php8.3-mysql php8.3-mbstring php8.3-xml php8.3-curl php8.3-zip php8.3-gd \
    phpmyadmin \
    && rm -rf /var/lib/apt/lists/*

# ── Step 5: Pre-download Go dependencies (cached layer — only rebuilds if go.mod changes) ──
WORKDIR /root/AKpanel

# Copy only go.mod and go.sum first to leverage Docker layer caching
COPY go.mod go.sum ./
RUN go mod download

# ── Step 6: Pre-build frontend (cached layer — only rebuilds if package.json changes) ──
COPY package.json package-lock.json* ./
RUN npm install --prefer-offline || npm install

# ── Step 7: systemd as PID 1 ─────────────────────────────────────────────────
# The panel drives daemons through systemctl, so the dev container boots real systemd
# (like a VPS) and provisions itself through a one-shot unit.
RUN systemctl mask getty@tty1.service console-getty.service systemd-logind.service \
        systemd-remount-fs.service sys-kernel-config.mount sys-kernel-debug.mount \
        systemd-udevd.service systemd-udev-trigger.service >/dev/null 2>&1 || true
COPY docker/akpanel-dev-setup.sh /usr/local/bin/akpanel-dev-setup.sh
COPY docker/akpanel-dev-setup.service /etc/systemd/system/akpanel-dev-setup.service
# Hybrid profile: Apache sits behind Nginx on 8081, so it must never grab port 80 at boot.
RUN sed -i 's/^Listen 80$/Listen 8081/' /etc/apache2/ports.conf \
    && sed -i 's/<VirtualHost \*:80>/<VirtualHost *:8081>/' /etc/apache2/sites-available/000-default.conf \
    && a2enmod -q rewrite proxy proxy_fcgi proxy_http headers setenvif
RUN chmod +x /usr/local/bin/akpanel-dev-setup.sh \
    && systemctl enable akpanel-dev-setup.service cron

# Expose ports:
# 2087: AKpanel Admin Panel
# 2083: AKpanel Client Portal
# 80/443: Nginx hosted sites
EXPOSE 2087 2083 80 443 21 30000-30009

STOPSIGNAL SIGRTMIN+3
ENTRYPOINT ["/sbin/init"]
