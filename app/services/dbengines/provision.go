package dbengines

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"goravel/app/facades"
	"goravel/app/paths"
	"goravel/app/services"
)

func mysqlRootPassword() string {
	secretFile := paths.EtcAKpanelSecrets + "/mysql_root"
	if b, err := os.ReadFile(secretFile); err == nil && strings.TrimSpace(string(b)) != "" {
		return strings.TrimSpace(string(b))
	}
	if p := facades.Config().GetString("akpanel.mysql_root_password"); p != "" {
		return p
	}
	return ""
}

// ProvisionMySQLUser creates a scoped MySQL/MariaDB user for a hosting account.
func ProvisionMySQLUser(username, password string) error {
	if password == "" {
		return fmt.Errorf("password required for mysql user")
	}
	rootPass := mysqlRootPassword()
	scopedSQL := fmt.Sprintf(
		"CREATE USER IF NOT EXISTS '%s'@'localhost' IDENTIFIED BY '%s';"+
			"CREATE USER IF NOT EXISTS '%s'@'127.0.0.1' IDENTIFIED BY '%s';"+
			"ALTER USER '%s'@'localhost' IDENTIFIED BY '%s';"+
			"ALTER USER '%s'@'127.0.0.1' IDENTIFIED BY '%s';"+
			"GRANT ALL PRIVILEGES ON `%s_%%`.* TO '%s'@'localhost';"+
			"GRANT ALL PRIVILEGES ON `%s_%%`.* TO '%s'@'127.0.0.1';"+
			"GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'localhost';"+
			"GRANT ALL PRIVILEGES ON `%s`.* TO '%s'@'127.0.0.1';"+
			"FLUSH PRIVILEGES;",
		username, password, username, password,
		username, password, username, password,
		username, username, username, username,
		username, username, username, username,
	)

	if rootPass != "" {
		cmd := exec.Command("mysql", "-u", "root", "-p"+rootPass, "-e", scopedSQL)
		if err := cmd.Run(); err == nil {
			services.PersistAccountMySQLPassword(username, password)
			return nil
		}
	}
	cmd2 := exec.Command("mysql", "-u", "ak_admin", "-e", scopedSQL)
	if err := cmd2.Run(); err == nil {
		services.PersistAccountMySQLPassword(username, password)
		return nil
	}
	if err := services.ExecMySQL(scopedSQL); err != nil {
		return err
	}
	services.PersistAccountMySQLPassword(username, password)
	return nil
}

// ProvisionPostgreSQLUser creates a PostgreSQL role and default database.
func ProvisionPostgreSQLUser(username, password string) error {
	if password == "" {
		return fmt.Errorf("password required for postgresql user")
	}
	dbName := username + "_db"
	// Escape single quotes in password for psql
	safePass := strings.ReplaceAll(password, "'", "''")
	sql := fmt.Sprintf(
		"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '%s') THEN CREATE ROLE \"%s\" LOGIN PASSWORD '%s'; END IF; END $$;"+
			"SELECT 'CREATE DATABASE \"%s\" OWNER \"%s\"' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '%s')\\gexec",
		username, username, safePass, dbName, username, dbName,
	)
	cmd := exec.Command("su", "-", "postgres", "-c", "psql -v ON_ERROR_STOP=1 -c "+quoteSQL(sql))
	return cmd.Run()
}

func quoteSQL(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\"'\"'`) + "'"
}

// DropMySQLUser removes scoped MySQL users (best-effort).
func DropMySQLUser(username string) {
	sql := fmt.Sprintf("DROP USER IF EXISTS '%s'@'localhost'; DROP USER IF EXISTS '%s'@'127.0.0.1'; FLUSH PRIVILEGES;", username, username)
	_ = services.ExecMySQL(sql)
}

// DropPostgreSQLUser drops role and database (best-effort).
func DropPostgreSQLUser(username string) {
	dbName := username + "_db"
	sql := fmt.Sprintf("DROP DATABASE IF EXISTS \"%s\"; DROP ROLE IF EXISTS \"%s\";", dbName, username)
	_ = exec.Command("su", "-", "postgres", "-c", "psql -c "+quoteSQL(sql)).Run()
}
