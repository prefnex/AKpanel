package services

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"sync"
)

const (
	redisACLFile   = "/etc/redis/users.acl"
	redisConfFile  = "/etc/redis/redis.conf"
	redisAdminUser = "akpanel-admin"
)

var redisACLName = regexp.MustCompile(`^[a-zA-Z0-9_][a-zA-Z0-9_-]{1,31}$`)

type RedisService struct {
	mu sync.Mutex
}

var (
	redisServiceInstance *RedisService
	redisOnce            sync.Once
)

func GetRedisService() *RedisService {
	redisOnce.Do(func() {
		redisServiceInstance = &RedisService{}
	})
	return redisServiceInstance
}

func redisAdminPass() string {
	return persistSecret("redis_admin", 32)
}

func (r *RedisService) installed() bool {
	_, err := exec.LookPath("redis-cli")
	if err != nil {
		_, err = exec.LookPath("redis-server")
	}
	return err == nil
}

// EnsureHardened turns off the open default user, binds localhost, and loads ACLs.
func (r *RedisService) EnsureHardened() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if !r.installed() {
		return nil
	}
	_ = os.MkdirAll("/etc/redis", 0755)
	admin := redisAdminPass()
	hash := redisSHA256(admin)

	changed := false
	existing, _ := os.ReadFile(redisACLFile)
	body := string(existing)
	if !strings.Contains(body, "user "+redisAdminUser+" ") {
		body = fmt.Sprintf("user default off\nuser %s on #%s ~* &* +@all\n", redisAdminUser, hash) + stripDefaultAndAdmin(body)
		_ = os.WriteFile(redisACLFile, []byte(strings.TrimSpace(body)+"\n"), 0640)
		_ = exec.Command("chown", "redis:redis", redisACLFile).Run()
		changed = true
	}

	confChanged, _ := patchRedisConf()
	if changed || confChanged {
		_ = exec.Command("systemctl", "restart", "redis-server").Run()
		_ = exec.Command("systemctl", "restart", "redis").Run()
	}
	return nil
}

func stripDefaultAndAdmin(acl string) string {
	var out []string
	for _, line := range strings.Split(acl, "\n") {
		trim := strings.TrimSpace(line)
		if trim == "" || strings.HasPrefix(trim, "user default ") || strings.HasPrefix(trim, "user "+redisAdminUser+" ") {
			continue
		}
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

func patchRedisConf() (bool, error) {
	b, err := os.ReadFile(redisConfFile)
	if err != nil {
		conf := `bind 127.0.0.1 -::1
protected-mode yes
port 6379
aclfile /etc/redis/users.acl
supervised systemd
`
		return true, os.WriteFile(redisConfFile, []byte(conf), 0640)
	}
	s := string(b)
	if strings.Contains(s, "aclfile /etc/redis/users.acl") && strings.Contains(s, "bind 127.0.0.1") {
		return false, nil
	}
	s = commentRedisDirective(s, "bind")
	s = commentRedisDirective(s, "protected-mode")
	s = commentRedisDirective(s, "aclfile")
	s = commentRedisDirective(s, "requirepass")
	s += "\n# AKpanel Redis isolation\nbind 127.0.0.1 -::1\nprotected-mode yes\naclfile /etc/redis/users.acl\n"
	return true, os.WriteFile(redisConfFile, []byte(s), 0640)
}

func commentRedisDirective(s, key string) string {
	var lines []string
	for _, line := range strings.Split(s, "\n") {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, key+" ") || trim == key {
			lines = append(lines, "# "+line)
			continue
		}
		lines = append(lines, line)
	}
	return strings.Join(lines, "\n")
}

func redisSHA256(password string) string {
	sum := sha256.Sum256([]byte(password))
	return hex.EncodeToString(sum[:])
}

func (r *RedisService) adminCLI(args ...string) *exec.Cmd {
	admin := redisAdminPass()
	full := append([]string{"--no-auth-warning", "--user", redisAdminUser, "-a", admin}, args...)
	return exec.Command("redis-cli", full...)
}

func (r *RedisService) tryAdmin(args ...string) error {
	cmd := r.adminCLI(args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		plain := exec.Command("redis-cli", args...)
		if out2, err2 := plain.CombinedOutput(); err2 != nil {
			return fmt.Errorf("redis-cli: %v %s %s", err, strings.TrimSpace(string(out)), strings.TrimSpace(string(out2)))
		}
	}
	return nil
}

func sanitizeRedisACLUser(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	name = strings.ReplaceAll(name, ".", "_")
	if !redisACLName.MatchString(name) || name == "default" || name == redisAdminUser || name == "root" {
		return ""
	}
	return name
}

// ProvisionUser creates a jailed Redis ACL account: own key prefix, DB 0 only, no admin commands.
func (r *RedisService) ProvisionUser(username, password string) error {
	user := sanitizeRedisACLUser(username)
	if user == "" || password == "" {
		return nil
	}
	_ = r.EnsureHardened()
	hash := redisSHA256(password)
	pattern := "~" + user + ":*"
	channel := "&" + user + ":*"
	if err := r.tryAdmin("ACL", "SETUSER", user, "reset", "on", "#"+hash,
		pattern, channel, "+@all", "-@dangerous", "-@admin", "+info", "+ping", "+select|0"); err != nil {
		return err
	}
	_ = r.tryAdmin("ACL", "SAVE")
	return nil
}

func (r *RedisService) SetUserPassword(username, password string) error {
	return r.ProvisionUser(username, password)
}

func (r *RedisService) DeleteUser(username string) error {
	user := sanitizeRedisACLUser(username)
	if user == "" {
		return nil
	}
	_ = r.tryAdmin("ACL", "DELUSER", user)
	_ = r.tryAdmin("ACL", "SAVE")
	return nil
}

// FlushAll is an administrator-only cache wipe (never exposed to tenant ACL users).
func (r *RedisService) FlushAll() error {
	_ = r.EnsureHardened()
	return r.tryAdmin("FLUSHALL")
}

func (r *RedisService) ConnectHint(username string) map[string]string {
	user := sanitizeRedisACLUser(username)
	return map[string]string{
		"host":     "127.0.0.1",
		"port":     "6379",
		"username": user,
		"prefix":   user + ":",
		"database": "0",
		"note":     "Authenticate as this Redis user. Keys outside " + user + ":* are invisible. FLUSHALL/CONFIG/ACL are denied.",
	}
}
