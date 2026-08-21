# AKpanel — Agent Instructions

> **اقرأ هذا الملف كاملاً قبل أي تعديل على المشروع.**

---

## ما هو AKpanel؟

AKpanel هو Web Hosting Control Panel مبني بـ:
- **Backend:** Go (Goravel framework) — API على port 2087
- **Frontend:** React (JSX) + Vite — مبني في `public/`
- **Database:** SQLite (GORM) + JSON files في `/etc/akpanel/`
- **Linux Services:** nginx + apache2 + varnish + php-fpm + bind9 + postfix

---

## 🔴 القواعد الحمراء — لا استثناء

### 1. لا تفترض الـ Web Server Profile
قبل أي تعديل على web server config:
```bash
cat /etc/akpanel/server_profile.conf
```
الأوضاع الممكنة: `nginx_phpfpm` | `apache_phpfpm` | `hybrid_nginx_apache` | `varnish_nginx_apache` | `varnish_nginx_phpfpm`

إذا Profile = `hybrid_nginx_apache` → يجب تعديل **nginx + apache** معاً.
إذا Profile = `varnish_nginx_apache` → يجب تعديل **nginx + apache + varnish** معاً.
**لا تعدل nginx وحده في profile يتطلب أكثر.**

### 2. لا Hardcoded Secrets
```go
// ❌ ممنوع
password := "akpanel123"

// ✅ الصحيح
password := facades.Config().GetString("akpanel.mysql_root_password")
```

### 3. لا exec.Command في Controllers أو Routes
```go
// ❌ ممنوع في controllers/routes
exec.Command("nginx", "-s", "reload").Run()

// ✅ الصحيح — في services فقط
serviceRegistry.Reload("nginx")
```

### 4. لا Imports ناقصة في React
كل component وكل Lucide icon يجب import صريح في أعلى الملف.
قبل حفظ أي JSX: تحقق أن كل اسم مستخدم في JSX له `import` مقابل.

### 5. مسار SSL الصحيح
```
/etc/akpanel/ssl/{domain}/fullchain.pem  ← اقرأ من هنا
/etc/akpanel/ssl/{domain}/privkey.pem
```
لا `/etc/letsencrypt/live/` في vhosts جديدة.

---

## 🟡 قبل البدء في أي Task

1. اقرأ `docs/AGENT_MASTER_PLAN.md` — خصوصاً §2.10 و §3.8 و §4
2. تحقق من `server_profile.conf` إذا task تتعلق بـ web servers
3. راجع المهارات في `.agents/skills/` المتعلقة بـ task الحالية:
   - **Web server config** → `.agents/skills/akpanel-webserver/SKILL.md`
   - **React/JSX** → `.agents/skills/akpanel-frontend/SKILL.md`
   - **Go backend** → `.agents/skills/akpanel-backend/SKILL.md`
   - **أي task** → `.agents/skills/akpanel-pre-task/SKILL.md`

---

## 🟢 المسارات المعتمدة

| السياق | المسار |
|--------|--------|
| Root admin site | `/var/www/sites/{domain}/public` |
| Client/user site | `/home/{username}/domains/{domain}/public_html` |
| Nginx vhosts | `/etc/nginx/sites-available/{domain}.conf` |
| Apache vhosts | `/etc/apache2/sites-available/{domain}.conf` |
| SSL certs | `/etc/akpanel/ssl/{domain}/fullchain.pem` |
| AKpanel config | `/etc/akpanel/install.conf` |
| AKpanel secrets | `/etc/akpanel/secrets/` (chmod 600) |

---

## 🟢 تسلسل Reload الإلزامي

```bash
nginx -t                                      # 1. Test nginx
apache2ctl configtest                         # 2. Test apache (إذا profile يشمله)
systemctl reload nginx                        # 3. Reload nginx
systemctl reload apache2                      # 4. Reload apache (إذا profile يشمله)
systemctl reload varnish                      # 5. Reload varnish (إذا profile يشمله)
```

---

## مخطط المعمارية المستهدفة

```
جميع Controllers
       ↓
  ServerManager (Orchestrator)
  ┌────┬────┬────┬────┐
  ↓    ↓    ↓    ↓    ↓
Vhost SSL  DNS Mail ServiceRegistry
  ↓    ↓    ↓    ↓    ↓
nginx acme BIND RC  systemd
```

**الحالة الحالية:** Controllers تستدعي Services مباشرة (مشكلة موثقة في AGENT_MASTER_PLAN.md §2.5)

---

## تعريف "تم" (Definition of Done)

Task لا تُعتبر مكتملة إلا إذا:
- [ ] `go build ./...` ينجح بدون errors
- [ ] `npm run build` ينجح بدون errors
- [ ] `nginx -t` يعطي OK
- [ ] لا hardcoded secrets جديدة
- [ ] لا imports ناقصة في JSX
- [ ] جدول التقدم في `docs/AGENT_MASTER_PLAN.md` محدَّث
- [ ] Acceptance criteria في الـ Task محققة

---

## تثبيت / إصدار / ريليز (إلزامي)

- الاختبار يكون على **VPS نظيف يُعاد بناؤه كل مرة** — لا تفترض باتش على سيرفر قديم.
- الإصدار الحالي ثابت: **`v0.1.0`**. بعد أي فيكس: ادفع `main` ثم حرّك **نفس التاج** `v0.1.0` (force-push) وانتظر ريليز GitHub Actions.
- أمر التثبيت على VPS جديد (root):

```bash
curl -fsSL https://github.com/prefnex/AKpanel/releases/download/v0.1.0/install.sh | bash
```

- لا تشغّل `nginx` / `systemctl` / البانل على جهاز التطوير.

> **للبدء السريع:** اقرأ `.agents/skills/akpanel-pre-task/SKILL.md` ثم حدد Task ID من `docs/AGENT_MASTER_PLAN.md`
