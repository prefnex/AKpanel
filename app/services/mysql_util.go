package services

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"

	"goravel/app/paths"
)

var mysqlIdentRe = regexp.MustCompile(`^[A-Za-z0-9_]{1,64}$`)

// IsValidMySQLIdent accepts identifiers that are safe to place inside backticks or quotes.
func IsValidMySQLIdent(s string) bool {
	return mysqlIdentRe.MatchString(s)
}

// MySQLEscape escapes a value for use inside a single-quoted MySQL string literal.
func MySQLEscape(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `'`, `\'`, "\x00", `\0`, "\n", `\n`, "\r", `\r`, "\x1a", `\Z`)
	return r.Replace(s)
}

// WithMySQLPassword hands the password to the mysql client through the environment so it never
// appears in the process list (argv is world-readable through /proc).
func WithMySQLPassword(cmd *exec.Cmd, pass string) *exec.Cmd {
	if pass != "" {
		cmd.Env = append(os.Environ(), "MYSQL_PWD="+pass)
	}
	return cmd
}

// mysqlRootQuery runs a read-only query as MariaDB root and returns one string per row.
func mysqlRootQuery(query string) ([]string, error) {
	rootPass := ""
	if b, err := os.ReadFile(paths.EtcAKpanelSecrets + "/mysql_root"); err == nil {
		rootPass = strings.TrimSpace(string(b))
	}
	var out []byte
	var err error
	if rootPass != "" {
		out, err = WithMySQLPassword(exec.Command("mysql", "-u", "root", "-h", "127.0.0.1", "-N", "-B", "-e", query), rootPass).Output()
	}
	if rootPass == "" || err != nil {
		out, err = exec.Command("mysql", "--protocol=socket", "-u", "root", "-N", "-B", "-e", query).Output()
	}
	if err != nil {
		return nil, err
	}
	var rows []string
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line = strings.TrimSpace(line); line != "" {
			rows = append(rows, line)
		}
	}
	return rows, nil
}

// DropAccountMySQL removes every database and MySQL user that belongs to a hosting account
// (the account user itself plus anything named "<account>_...").
func DropAccountMySQL(username string) {
	if !IsValidMySQLIdent(username) {
		return
	}
	prefix := strings.ReplaceAll(username, "_", `\\_`) + `\\_%`
	dbs, _ := mysqlRootQuery(fmt.Sprintf("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE '%s'", prefix))
	var stmts []string
	for _, db := range dbs {
		if IsValidMySQLIdent(db) && strings.HasPrefix(db, username+"_") {
			stmts = append(stmts, fmt.Sprintf("DROP DATABASE IF EXISTS `%s`;", db))
		}
	}
	users, _ := mysqlRootQuery(fmt.Sprintf("SELECT user, host FROM mysql.user WHERE user = '%s' OR user LIKE '%s'", username, prefix))
	for _, row := range users {
		parts := strings.SplitN(row, "\t", 2)
		if len(parts) != 2 || !IsValidMySQLIdent(parts[0]) || strings.ContainsAny(parts[1], "'\\") {
			continue
		}
		if parts[0] == username || strings.HasPrefix(parts[0], username+"_") {
			stmts = append(stmts, fmt.Sprintf("DROP USER IF EXISTS '%s'@'%s';", parts[0], parts[1]))
		}
	}
	if len(stmts) > 0 {
		_ = ExecMySQL(strings.Join(stmts, "\n") + "\nFLUSH PRIVILEGES;")
	}
}
