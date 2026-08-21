package config

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/goravel/framework/contracts/database/driver"
	mysqlfacades "github.com/goravel/mysql/facades"
	sqlitefacades "github.com/goravel/sqlite/facades"
	"goravel/app/facades"
)

func init() {
	config := facades.Config()

	mysqlUser := envString(config.Env("DB_USERNAME", "akpanel"), "akpanel")
	mysqlPass := envString(config.Env("DB_PASSWORD", ""), "")
	if mysqlPass == "" {
		if b, err := os.ReadFile("/etc/akpanel/secrets/mysql_akpanel"); err == nil {
			mysqlPass = strings.TrimSpace(string(b))
		}
	}
	mysqlDB := envString(config.Env("DB_DATABASE", "akpanel"), "akpanel")
	if strings.Contains(mysqlDB, "/") || strings.HasSuffix(mysqlDB, ".sqlite") {
		mysqlDB = "akpanel"
	}
	mysqlHost := envString(config.Env("DB_HOST", "127.0.0.1"), "127.0.0.1")
	if mysqlHost == "" {
		mysqlHost = "127.0.0.1"
	}

	sqlitePath := "database/akpanel.sqlite"
	if _, err := os.Stat("/opt/akpanel/database"); err == nil {
		sqlitePath = "/opt/akpanel/database/akpanel.sqlite"
	}
	_ = os.MkdirAll(filepath.Dir(sqlitePath), 0755)

	want := strings.ToLower(envString(config.Env("DB_CONNECTION", "sqlite"), "sqlite"))
	if want == "mysql" && !mysqlPing(mysqlUser, mysqlPass, mysqlHost, mysqlDB) {
		want = "sqlite"
	}

	config.Add("database", map[string]any{
		"default": want,
		"connections": map[string]any{
			"sqlite": map[string]any{
				"database": sqlitePath,
				"prefix":   "",
				"singular": false,
				"via": func() (driver.Driver, error) {
					return sqlitefacades.Sqlite("sqlite")
				},
			},
			"mysql": map[string]any{
				"host":     mysqlHost,
				"port":     config.Env("DB_PORT", 3306),
				"database": mysqlDB,
				"username": mysqlUser,
				"password": mysqlPass,
				"charset":  "utf8mb4",
				"prefix":   "",
				"singular": false,
				"via": func() (driver.Driver, error) {
					return mysqlfacades.Mysql("mysql")
				},
			},
		},
		"pool": map[string]any{
			"max_idle_conns":    10,
			"max_open_conns":    40,
			"conn_max_idletime": 3600,
			"conn_max_lifetime": 3600,
		},
		"slow_threshold": 200,
		"migrations": map[string]any{
			"table": "migrations",
		},
	})
}

func envString(v any, fallback string) string {
	if v == nil {
		return fallback
	}
	s := strings.TrimSpace(fmt.Sprint(v))
	if s == "" || s == "<nil>" {
		return fallback
	}
	return s
}

func mysqlPing(user, pass, host, dbName string) bool {
	if user == "" || dbName == "" {
		return false
	}
	dsn := user + ":" + pass + "@tcp(" + host + ":3306)/" + dbName + "?timeout=1s"
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return false
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	return db.PingContext(ctx) == nil
}
