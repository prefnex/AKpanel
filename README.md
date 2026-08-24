# AKpanel

A Linux hosting control panel you actually run on a VPS: websites, DNS, mail, FTP, PHP, and databases — with a root admin desk and a separate panel for each customer.

It is early software (`v0.1.0`). Treat a **clean Ubuntu VPS** as the real test environment, not a laptop and not an old server you keep patching.

---

**عربي (مختصر)** — AKpanel لوحة استضافة ويب للينكس: لوحة روت (WHM) على المنفذ `2087` ولوحة عميل على `2083`. التثبيت الرسمي أمر واحد على سيرفر أوبونتو نظيف كـ root. بعد التثبيت احفظ الباسورد العشوائي، ووجّه الـ hostname بـ A record، ولو هتبعت ميل اضبط PTR عند مزوّد السيرفر. التفاصيل الكاملة بالإنجليزي تحت.

---

## What you get

Two doors, one machine.

| Door | Port | Who uses it |
| --- | --- | --- |
| Root admin (WHM-style) | **2087** | You: accounts, packages, DNS, mail policy, PHP, firewall, server settings |
| Client portal | **2083** | Your customer: their sites, files, FTP, databases, email, php.ini (capped by the plan) |
| Sites on the internet | **80 / 443** | The actual hosted domains |

phpMyAdmin and Roundcube sit behind the panel (SSO), not as public “guess the URL” admin pages.

Under the hood it is a **Go** binary (Goravel) plus a **React** UI, talking to the usual Ubuntu stack: Nginx (and optionally Apache / Varnish), PHP-FPM, MariaDB, BIND 9, Postfix, Dovecot, OpenDKIM, Pure-FTPd.

---

## Requirements

- A **fresh** Ubuntu LTS VPS (22.04 or 24.04). Reinstall the OS if you already experimented on it.
- Root SSH.
- Public IPv4. IPv6 is optional; Dual-Stack publishes AAAA when the box has a real address.
- Enough RAM for PHP-FPM + mail + BIND. A small hosting node is fine; a 1 GB box will feel tight.
- If you want a pretty hostname (`server.example.com`) and Let’s Encrypt: an **A record** pointing at this VPS **before** or right after install. Let’s Encrypt has weekly rate limits — if you reinstall the same name too often, the installer falls back to a self-signed cert until the window resets.

This is not a Windows panel, not a shared Docker demo, and not something you “upgrade in place” on a dirty server. The owner’s workflow is: rebuild the VPS, run the installer again.

---

## Install (production)

On the VPS, as root:

```bash
curl -fsSL https://github.com/prefnex/AKpanel/releases/download/v0.1.0/install.sh | bash
```

That script downloads `akpanel_v0.1.0_linux_<amd64|arm64>.tar.gz` from the **same GitHub release**. Do not copy a binary from your PC onto an old VPS unless you are deliberately debugging.

### What the installer asks

You can press Enter to skip identity fields.

1. **Panel hostname** — e.g. `server.example.com`. Used for the machine name, BIND, and hostname SSL (Let’s Encrypt, then ZeroSSL if LE fails).
2. **Nameservers** — e.g. `ns1.example.com` / `ns2.example.com` if this box will be authoritative DNS.
3. **Admin email** — SSL notices.
4. **Web stack** (default 1):
   - Nginx + PHP-FPM (fastest, default)
   - Apache + PHP
   - Nginx in front of Apache
   - Varnish + Nginx + Apache
   - Varnish + Nginx + PHP-FPM
5. **Extra PHP versions** — 8.3 is always installed. You can add 7.4, 8.0, 8.1, 8.2, 8.4.

Flags:

```bash
bash install.sh --verbose    # noisy apt / service logs
bash install.sh --rebuild    # wipe previous AKpanel bits, then install
bash install.sh -y           # non-interactive (defaults)
```

Logs land in `/var/log/akpanel-install.log`.

When it finishes you get:

- Admin URL: `https://YOUR_IP:2087` (plain `http://` on the IP also works)
- If hostname + DNS are ready: `https://server.example.com:2087`
- Client URL: `https://YOUR_IP:2083`
- Username: **`root`**
- Password: **random**, printed once in red. Copy it.

Credentials reminder file (no plaintext password after the first screen):

`/etc/akpanel/credentials.txt`

Forgot the password?

```bash
akpanel-reset-password
```

---

## After install — the boring-but-important list

**1. Open the firewall on the provider too.**  
The installer enables UFW for SSH, 2087, 2083, 80, 443, FTP (21 + passive `30000–30009`), DNS 53, and mail (25, 465, 587, 110, 143, 993, 995). Cloud security groups (Hetzner, AWS, …) are a second wall — open the same ports there.

**2. DNS for the panel hostname.**  
`server.example.com` → this VPS IPv4. Until that resolves, use the IP URLs.

**3. PTR / reverse DNS if you send mail.**  
Set the IPv4 PTR at the VPS provider to match the hostname you HELO with (the panel hostname). A Hetzner default like `static.x.x.x.x.clients.your-server.de` will fail a lot of spam tests even when SPF/DKIM look fine. Outbound mail stays on **IPv4**; providers are harsher on IPv6 senders.

**4. Glue records** if this server is `ns1` / `ns2` for customer domains. That is at the domain registrar, not inside AKpanel.

**5. Dual-Stack.**  
In Server Settings, Dual-Stack means AAAA on `@` and `*` using the panel IPv6. A separate switch can give each account an address from the same `/64`. Saving settings rebuilds every zone. `www` stays a CNAME — no AAAA on `www`. Mail records are not IPv6 on purpose.

---

## Day-to-day: admin vs client

### Root admin (`:2087`)

Typical flow:

1. Create a **package** (disk, mail, FTP, databases, **max PHP workers**, **RAM MB**).
2. Create a **user** with a main domain. Provisioning creates the Linux user, home, PHP-FPM pool, vhost, DNS zone, FTP, optional MySQL.
3. Tune DNS, SSL, PHP versions, mail (DKIM, SpamAssassin), firewall.

Package RAM and `max_php_children` are enforced on the **user FPM pool** (`pm.max_children` and `php_admin_value[memory_limit]`). The client cannot raise memory above that from php.ini. System `nproc` is still the process ulimit — a different knob.

### Client (`:2083`)

The customer logs in with the hosting username. They get their sites, file manager, FTP (primary account always listed), databases + phpMyAdmin SSO, mailboxes + webmail, and PHP settings clamped to the plan.

Site files live at:

```text
/home/{username}/domains/{domain}/public_html
```

Root-owned sites (admin websites) live at:

```text
/var/www/sites/{domain}/public
```

SSL files the panel writes:

```text
/etc/akpanel/ssl/{domain}/fullchain.pem
/etc/akpanel/ssl/{domain}/privkey.pem
```

---

## Ports (full map)

| Port | Service |
| --- | --- |
| 2087 | Admin panel |
| 2083 | Client panel |
| 80 / 443 | Hosted websites |
| 21 + 30000–30009 | FTP / FTPS passive |
| 53 TCP/UDP | BIND |
| 25 / 465 / 587 | SMTP |
| 143 / 993 | IMAP |
| 110 / 995 | POP3 |
| 8085 | phpMyAdmin (proxied) |
| 8086 | Roundcube (proxied as `webmail.*`) |

---

## Where things live on disk

| Path | What |
| --- | --- |
| `/opt/akpanel` | Installed panel files |
| `/usr/local/bin/akpanel` | Binary |
| `/etc/akpanel/` | Config, packages, users, DNS JSON, `server_profile.conf` |
| `/etc/akpanel/secrets/` | MySQL and other secrets (`chmod 600`) |
| `/etc/akpanel/root.auth` | Admin password hash |
| `/var/log/akpanel-install.log` | Installer log |
| `systemctl status akpanel` | Panel process |

Web profile (do not guess):

```bash
cat /etc/akpanel/server_profile.conf
```

Possible values: `nginx_phpfpm`, `apache_phpfpm`, `hybrid_nginx_apache`, `varnish_nginx_apache`, `varnish_nginx_phpfpm`.

---

## Features, in plain language

- **Accounts & packages** — quotas, shells, AutoSSL, reseller flag, PHP worker and RAM caps.
- **Web** — vhosts for the stack you picked at install; isolated PHP-FPM pool per user.
- **DNS** — BIND zones, templates, nameservers, Dual-Stack AAAA rebuild.
- **Mail** — Postfix + Dovecot, DKIM, SPF/DMARC records, Roundcube, spam scoring.
- **FTP** — Pure-FTPd virtual users (PureDB), primary account plus extras.
- **Databases** — MariaDB for the panel and for customer DBs; phpMyAdmin with SSO.
- **SSL** — hostname cert at install; per-site certs from the panel (acme.sh).
- **IPv6** — optional Dual-Stack and optional dedicated address per account from the server `/64`.

---

## Reinstall / “I broke the box”

The supported path is a **new OS image**, then the same curl command. `--rebuild` wipes AKpanel directories on an existing OS; a full VPS rebuild is cleaner if packages and leftover Apache/Nginx configs are a mess.

---

## Build from source (developers)

You do not need this to run a hosting node. Use it to change the panel itself.

Need **Go 1.23+** and **Node 20+**.

```bash
make build          # frontend + binary ./akpanel
make package        # linux amd64 + arm64 tarballs
make clean
```

Local `npm run build` writes into `public/build/`. Do not run `nginx -t` / `systemctl` on a workstation and call it a production test.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| API / panel process | Go 1.23, Goravel, listens on 2087 (client UI is served / proxied as 2083) |
| UI | React 18, Vite, Tailwind, Radix |
| Panel + customer MySQL | MariaDB |
| HTTP | Nginx; Apache and Varnish when the profile says so |
| PHP | FPM 8.3 (+ extras you selected) |
| DNS | BIND 9 |
| Mail | Postfix, Dovecot, OpenDKIM, SpamAssassin |
| FTP | Pure-FTPd |
| License | [Apache 2.0](LICENSE) |

---

## Support and honesty

This is `v0.1.0`. Expect sharp edges. Report issues with: Ubuntu version, web profile, hostname, and the installer log. Issues and releases: [github.com/prefnex/AKpanel](https://github.com/prefnex/AKpanel).

If something failed halfway, start over on a clean VPS rather than hand-editing five config trees. That is how the panel is meant to be tested.
