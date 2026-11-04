package services

import (
	"encoding/json"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newTestAuthService(t *testing.T) *AuthService {
	t.Helper()
	dir := t.TempDir()
	hash, err := bcryptHash("correct-horse-battery")
	if err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(RootAuthData{Username: "root", Hash: hash})
	authFile := filepath.Join(dir, "root.auth")
	if err := os.WriteFile(authFile, data, 0600); err != nil {
		t.Fatal(err)
	}
	return &AuthService{
		authFile:  authFile,
		secretKey: []byte(strings.Repeat("k", 64)),
		revoked:   map[string]int64{},
	}
}

func TestTokensAreScoped(t *testing.T) {
	s := newTestAuthService(t)
	client, _ := s.IssueToken("alice", "client", TokenScopeClient, time.Hour)
	admin, _ := s.IssueToken("root", "root_admin", TokenScopeAdmin, time.Hour)

	if _, ok := s.ValidateToken(client); ok {
		t.Fatal("client token must not be accepted as an admin token")
	}
	if _, ok := s.ValidateScoped(admin, TokenScopeClient); ok {
		t.Fatal("admin token must not be accepted by the client portal")
	}
	if _, ok := s.ValidateToken(admin); !ok {
		t.Fatal("admin token should validate")
	}
	if claims, ok := s.ValidateScoped(client, TokenScopeClient); !ok || claims["username"] != "alice" {
		t.Fatal("client token should validate for its scope")
	}
}

func TestTokenRejections(t *testing.T) {
	s := newTestAuthService(t)

	expired, _ := s.IssueToken("root", "root_admin", TokenScopeAdmin, -time.Minute)
	if _, ok := s.ValidateToken(expired); ok {
		t.Fatal("expired token accepted")
	}

	other := newTestAuthService(t)
	other.secretKey = []byte(strings.Repeat("x", 64))
	forged, _ := other.IssueToken("root", "root_admin", TokenScopeAdmin, time.Hour)
	if _, ok := s.ValidateToken(forged); ok {
		t.Fatal("token signed with another key accepted")
	}

	good, _ := s.IssueToken("root", "root_admin", TokenScopeAdmin, time.Hour)
	s.Revoke(good)
	if _, ok := s.ValidateToken(good); ok {
		t.Fatal("revoked token accepted")
	}

	parts := strings.Split(good, ".")
	none := b64([]byte(`{"alg":"none","typ":"JWT"}`)) + "." + parts[1] + "."
	if _, ok := s.ValidateToken(none); ok {
		t.Fatal("alg=none token accepted")
	}
}

func TestPasswordChangeInvalidatesOldTokens(t *testing.T) {
	s := newTestAuthService(t)
	old, _ := s.IssueToken("root", "root_admin", TokenScopeAdmin, time.Hour)
	time.Sleep(1100 * time.Millisecond)

	data, _ := s.getRootData()
	data.TokensValidAfter = time.Now().Unix()
	_ = s.saveRootData(data)

	if _, ok := s.ValidateToken(old); ok {
		t.Fatal("token issued before the password change is still valid")
	}
	fresh, _ := s.IssueToken("root", "root_admin", TokenScopeAdmin, time.Hour)
	if _, ok := s.ValidateToken(fresh); !ok {
		t.Fatal("token issued after the password change should validate")
	}
}

func TestLegacyRootHashStillVerifies(t *testing.T) {
	data := &RootAuthData{Salt: "abc", Hash: legacyHash("pw123456789", "abc")}
	if ok, upgrade := verifyRoot(data, "pw123456789"); !ok || !upgrade {
		t.Fatal("legacy hash should verify and request an upgrade")
	}
	if ok, _ := verifyRoot(data, "wrong"); ok {
		t.Fatal("wrong password accepted")
	}
}

func TestLoginLimiter(t *testing.T) {
	l := &LoginLimiter{failures: map[string][]time.Time{}}
	for i := 0; i < maxFailsPerKey; i++ {
		if ok, _ := l.Allowed("admin", "1.2.3.4", "root"); !ok {
			t.Fatalf("blocked too early at attempt %d", i)
		}
		l.Fail("admin", "1.2.3.4", "root")
	}
	if ok, wait := l.Allowed("admin", "1.2.3.4", "root"); ok || wait <= 0 {
		t.Fatal("expected lockout after repeated failures")
	}
	if ok, _ := l.Allowed("admin", "5.6.7.8", "root"); !ok {
		t.Fatal("other clients must not be locked out")
	}
}

func TestAccountUsernames(t *testing.T) {
	for _, bad := range []string{"root", "admin", "www-data", "a", "1abc", "x;id", "../etc", "UPPER", "averyveryverylongname1"} {
		if IsValidNewAccountUsername(bad) {
			t.Errorf("%q should be rejected for new accounts", bad)
		}
	}
	for _, good := range []string{"alice", "client1", "shop42"} {
		if !IsValidNewAccountUsername(good) {
			t.Errorf("%q should be accepted", good)
		}
	}
	if !IsValidAccountUsername("legacy_user") || IsValidAccountUsername("admin") {
		t.Error("legacy username rules are wrong")
	}
}

func TestCronValidation(t *testing.T) {
	if s, err := NormalizeCronSchedule("*/5  *  * * 1-5"); err != nil || s != "*/5 * * * 1-5" {
		t.Fatalf("valid schedule rejected: %q %v", s, err)
	}
	if s, err := NormalizeCronSchedule("@Daily"); err != nil || s != "@daily" {
		t.Fatalf("macro rejected: %q %v", s, err)
	}
	for _, bad := range []string{"* * * * * root", "* * * *", "@reboot", "* * * * $(id)"} {
		if _, err := NormalizeCronSchedule(bad); err == nil {
			t.Errorf("schedule %q should be rejected", bad)
		}
	}
	if ValidateCronCommand("id\n* * * * * root id") == nil {
		t.Error("multi-line command accepted")
	}
	if ValidateCronCommand("php /home/a/cron.php") != nil {
		t.Error("normal command rejected")
	}
}

func TestRemoteURLAndAddressFiltering(t *testing.T) {
	for _, bad := range []string{"file:///etc/shadow", "gopher://x", "ftp://example.com/a", "http://user:pw@example.com/", "--upload-pack=x", ""} {
		if _, err := ValidateRemoteURL(bad); err == nil {
			t.Errorf("URL %q should be rejected", bad)
		}
	}
	if _, err := ValidateRemoteURL("https://example.com/file.zip"); err != nil {
		t.Error("https URL rejected")
	}
	for _, ip := range []string{"127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1"} {
		if isPublicIP(net.ParseIP(ip)) {
			t.Errorf("%s should be treated as internal", ip)
		}
	}
	for _, ip := range []string{"1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"} {
		if !isPublicIP(net.ParseIP(ip)) {
			t.Errorf("%s should be public", ip)
		}
	}
}

func TestMySQLHelpers(t *testing.T) {
	for _, bad := range []string{"a`b", "x; DROP DATABASE mysql", "a b", "", strings.Repeat("a", 65)} {
		if IsValidMySQLIdent(bad) {
			t.Errorf("%q should be rejected", bad)
		}
	}
	if got := MySQLEscape(`a'b\c`); got != `a\'b\\c` {
		t.Errorf("unexpected escape: %s", got)
	}
}
