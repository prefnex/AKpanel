# 🚀 AKpanel
**A Next-Generation, High-Performance Linux Web Hosting & Server Control Panel**

[![Release](https://img.shields.io/github/v/release/prefnex/AKpanel?color=blue&label=version)](https://github.com/prefnex/AKpanel/releases)
[![Go Version](https://img.shields.io/badge/Go-1.23+-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![License](https://img.shields.io/badge/License-Apache_2.0-green.svg)](LICENSE)

AKpanel is a modern, lightweight, and blazing-fast Linux hosting control panel built for **Ubuntu 22.04 LTS**. Designed with a dual-portal architecture, it provides an enterprise **Root/WHM Admin Dashboard (Port 2087)** and an isolated **Client/Tenant Hosting Panel (Port 2083)** with full system metrics, multi-PHP engine, automated Nginx virtual hosts, database management with phpMyAdmin SSO, BIND9 DNS server, and mail server capabilities.

---

## ⚡ 1-Line Instant Installation

Run the following command on a clean **Ubuntu 22.04 LTS** server as `root`:

```bash
curl -fsSL https://raw.githubusercontent.com/prefnex/AKpanel/main/install.sh | sudo bash
```

The installer will automatically detect your server architecture (`x86_64` / `arm64`), download the latest release bundle, set up all web and database services, configure systemd, and launch AKpanel in seconds.

---

## 🌐 Dual-Port Architecture & Port Map 

| Service | Port | Description |
| :--- | :--- | :--- |
| 👑 **Root Admin (WHM)** | `2087` | Server monitoring, user accounts, packages, DNS, services, PHP config |
| 👤 **Client Portal (cPanel)** | `2083` | Tenant website manager, databases, phpMyAdmin SSO, file manager, SSL |
| 🌐 **HTTP Web Server** | `80` | Production hosted websites (Nginx / Apache) |
| 🔒 **HTTPS Web Server** | `443` | SSL-enabled hosted websites |
| 🗄️ **phpMyAdmin SSO** | `8085` | Isolated background phpMyAdmin single sign-on daemon |

---

## 🛠️ Tech Stack

- **Backend Core**: [Go (Golang)](https://go.dev/) + Goravel (High-performance compiled binary)
- **Frontend Dashboard**: React 18 + Vite + Tailwind CSS + Radix UI (Glassmorphic dark UI)
- **Database**: SQLite (Zero-configuration internal database) + MariaDB / MySQL for client databases
- **Web Servers**: Nginx (Reverse proxy & fast static engine) + Apache2 + Varnish Cache
- **PHP Engine**: Multi-PHP FPM (8.1, 8.2, 8.3) with isolated pools and real-time INI tuning
- **DNS Server**: BIND 9 (Full DNS zone management, templating, and cluster sync)
- **Mail Stack**: Postfix + Dovecot + OpenDKIM + SpamAssassin
- **Target OS**: Ubuntu 22.04 LTS / Debian 12

---

## 📦 Developer Guide & Local Build

### Requirements
- Go 1.23+
- Node.js 20+ & npm

### Commands via Makefile
```bash
# Build React frontend & Go backend
make build

# Package release bundles for AMD64 & ARM64
make package

# Create and push a new release tag
make release-tag VERSION=0.1.0

# Clean build artifacts
make clean
```

---

## ⚖️ License

Distributed under the **Apache 2.0 License**. See [LICENSE](LICENSE) for more information.
