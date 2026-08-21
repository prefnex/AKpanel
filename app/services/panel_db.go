package services

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"goravel/app/paths"
)

const panelDBName = "akpanel"
const panelDBUser = "akpanel"

func panelSecret(name string) string {
	return persistSecret(name, 24)
}

func PanelMySQLPassword() string {
	if p := strings.TrimSpace(os.Getenv("DB_PASSWORD")); p != "" && os.Getenv("DB_USERNAME") == panelDBUser {
		return p
	}
	b, err := os.ReadFile(filepath.Join(paths.EtcAKpanelSecrets, "mysql_akpanel"))
	if err != nil {
		return panelSecret("mysql_akpanel")
	}
	s := strings.TrimSpace(string(b))
	if s == "" {
		return panelSecret("mysql_akpanel")
	}
	return s
}

func mysqlRootPassword() string {
	b, err := os.ReadFile(filepath.Join(paths.EtcAKpanelSecrets, "mysql_root"))
	if err == nil {
		if s := strings.TrimSpace(string(b)); s != "" {
			return s
		}
	}
	return panelSecret("mysql_root")
}

func execMySQLRoot(sqlStr string) error {
	rootPass := mysqlRootPassword()
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	if rootPass != "" {
		cmd := exec.CommandContext(ctx, "mysql", "--protocol=socket", "-u", "root", "-p"+rootPass, "-e", sqlStr)
		if err := cmd.Run(); err == nil {
			return nil
		}
	}
	ctx2, cancel2 := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel2()
	return exec.CommandContext(ctx2, "mysql", "--protocol=socket", "-u", "root", "-e", sqlStr).Run()
}

func writeMariaDBHardening() {
	dir := "/etc/mysql/mariadb.conf.d"
	if _, err := os.Stat(dir); err != nil {
		dir = "/etc/mysql/conf.d"
	}
	_ = os.MkdirAll(dir, 0755)
	body := `[mysqld]
bind-address = 127.0.0.1
skip-name-resolve
innodb_file_per_table = 1
innodb_buffer_pool_size = 192M
innodb_flush_log_at_trx_commit = 2
max_connections = 80
table_open_cache = 400
performance_schema = OFF
skip-log-bin
`
	if writeIfChanged(filepath.Join(dir, "99-akpanel.cnf"), body, 0644) {
		runTimeout(20*time.Second, "systemctl", "restart", "mariadb")
	}
}

// EnsurePanelMariaDB creates the panel schema/user, localhost-only MariaDB, and replica dir.
func EnsurePanelMariaDB() {
	_ = os.MkdirAll(paths.EtcAKpanelSecrets, 0700)
	_ = os.MkdirAll("/var/lib/akpanel/replica/json", 0750)
	writeMariaDBHardening()

	appPass := PanelMySQLPassword()
	rootPass := mysqlRootPassword()
	escApp := strings.ReplaceAll(appPass, "'", "")
	escRoot := strings.ReplaceAll(rootPass, "'", "")

	_ = execMySQLRoot(fmt.Sprintf(
		"CREATE DATABASE IF NOT EXISTS `%s` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"+
			"CREATE USER IF NOT EXISTS '%s'@'localhost' IDENTIFIED BY '%s';"+
			"CREATE USER IF NOT EXISTS '%s'@'127.0.0.1' IDENTIFIED BY '%s';"+
			"ALTER USER '%s'@'localhost' IDENTIFIED BY '%s';"+
			"ALTER USER '%s'@'127.0.0.1' IDENTIFIED BY '%s';"+
			"GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'localhost';"+
			"GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'127.0.0.1';"+
			"CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '%s';"+
			"ALTER USER 'root'@'127.0.0.1' IDENTIFIED BY '%s';"+
			"GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;"+
			"DROP USER IF EXISTS 'ak_admin'@'%%';"+
			"FLUSH PRIVILEGES;",
		panelDBName,
		panelDBUser, escApp, panelDBUser, escApp,
		panelDBUser, escApp, panelDBUser, escApp,
		panelDBName, panelDBUser, panelDBName, panelDBUser,
		escRoot, escRoot,
	))
}

func mysqlDSN() string {
	pass := PanelMySQLPassword()
	return fmt.Sprintf("%s:%s@tcp(127.0.0.1:3306)/%s?charset=utf8mb4&parseTime=True&loc=Local&timeout=1s",
		panelDBUser, pass, panelDBName)
}

func PanelMySQLReachable() bool {
	db, err := sql.Open("mysql", mysqlDSN())
	if err != nil {
		return false
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	return db.PingContext(ctx) == nil
}

func dumpPanelReplica() {
	_ = os.MkdirAll("/var/lib/akpanel/replica/json", 0750)
	pass := PanelMySQLPassword()
	out := "/var/lib/akpanel/replica/akpanel.sql"
	tmp := out + ".tmp"
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "mysqldump", "-u", panelDBUser, "-p"+pass,
		"--single-transaction", "--quick", "--skip-lock-tables", panelDBName)
	f, err := os.Create(tmp)
	if err != nil {
		return
	}
	cmd.Stdout = f
	cmd.Stderr = nil
	err = cmd.Run()
	_ = f.Close()
	if err == nil {
		_ = os.Rename(tmp, out)
		_ = os.Chmod(out, 0600)
	} else {
		_ = os.Remove(tmp)
	}
	for _, name := range []string{"users.json", "emails.json", "packages.json", "websites.json"} {
		src := filepath.Join("/etc/akpanel", name)
		if _, err := os.Stat(src); err == nil {
			_ = exec.Command("cp", "-a", src, "/var/lib/akpanel/replica/json/"+name).Run()
		}
	}
}

// StartPanelDBReplica mirrors the panel MariaDB + JSON so the last copy survives a crash.
func StartPanelDBReplica() {
	dumpPanelReplica()
	t := time.NewTicker(5 * time.Minute)
	defer t.Stop()
	for range t.C {
		if PanelMySQLReachable() {
			dumpPanelReplica()
		}
	}
}
