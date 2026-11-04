package services

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"goravel/app/paths"
)

// Token scopes. A token minted for one panel is never accepted by the other.
const (
	TokenScopeAdmin  = "admin"
	TokenScopeClient = "client"

	tokenIssuer   = "AKpanel"
	AdminTokenTTL = 12 * time.Hour
	ClientTokenTTL = 24 * time.Hour
)

type RootAuthData struct {
	Username string `json:"username"`
	// Salt is only present for legacy SHA-256 hashes; bcrypt hashes embed their own salt.
	Salt      string `json:"salt,omitempty"`
	Hash      string `json:"hash"`
	UpdatedAt string `json:"updated_at"`
	// TokensValidAfter invalidates every admin token issued before it (bumped on password change).
	TokensValidAfter int64 `json:"tokens_valid_after,omitempty"`
}

type AuthService struct {
	mu         sync.RWMutex
	authFile   string
	secretFile string
	secretKey  []byte

	revokedMu sync.Mutex
	revoked   map[string]int64 // jti -> exp
}

var (
	authServiceInstance *AuthService
	authOnce            sync.Once
)

func NewAuthService() *AuthService {
	authOnce.Do(func() {
		_ = os.MkdirAll(paths.EtcAKpanel, 0755)
		_ = os.MkdirAll(paths.EtcAKpanelSecrets, 0700)
		s := &AuthService{
			authFile:   filepath.Join(paths.EtcAKpanel, "root.auth"),
			secretFile: filepath.Join(paths.EtcAKpanel, "jwt.secret"),
			revoked:    map[string]int64{},
		}
		s.initSecretKey()
		s.initDefaultRoot()
		authServiceInstance = s
	})
	return authServiceInstance
}

func randomHex(n int) string {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		panic(fmt.Sprintf("crypto/rand unavailable: %v", err))
	}
	return hex.EncodeToString(buf)
}

func (s *AuthService) initSecretKey() {
	if content, err := os.ReadFile(s.secretFile); err == nil {
		if key := strings.TrimSpace(string(content)); len(key) >= 32 {
			s.secretKey = []byte(key)
			_ = os.Chmod(s.secretFile, 0600)
			return
		}
	}
	keyHex := randomHex(64)
	_ = os.WriteFile(s.secretFile, []byte(keyHex), 0600)
	s.secretKey = []byte(keyHex)
}

// legacyHash is the pre-bcrypt scheme, kept only to verify and upgrade old root.auth files.
func legacyHash(password, salt string) string {
	h := sha256.New()
	h.Write([]byte(password + ":" + salt + ":akpanel_root_pepper"))
	return hex.EncodeToString(h.Sum(nil))
}

func bcryptHash(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(b), err
}

func isBcrypt(hash string) bool {
	return strings.HasPrefix(hash, "$2a$") || strings.HasPrefix(hash, "$2b$") || strings.HasPrefix(hash, "$2y$")
}

// verifyRoot checks a password against root.auth; ok=true with upgrade=true means the
// stored hash is legacy and should be rewritten as bcrypt.
func verifyRoot(data *RootAuthData, password string) (ok bool, upgrade bool) {
	if isBcrypt(data.Hash) {
		return bcrypt.CompareHashAndPassword([]byte(data.Hash), []byte(password)) == nil, false
	}
	if data.Salt == "" {
		return false, false
	}
	match := subtle.ConstantTimeCompare([]byte(legacyHash(password, data.Salt)), []byte(data.Hash)) == 1
	return match, match
}

func (s *AuthService) initDefaultRoot() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.authFile); !os.IsNotExist(err) {
		return
	}

	// Never fall back to a well-known password: use the provisioned secret or mint one.
	secretPassFile := filepath.Join(paths.EtcAKpanelSecrets, "admin_root")
	pass := ""
	if b, err := os.ReadFile(secretPassFile); err == nil {
		pass = strings.TrimSpace(string(b))
	}
	if pass == "" {
		pass = randomHex(12)
		_ = os.WriteFile(secretPassFile, []byte(pass+"\n"), 0600)
		log.Printf("🔐 [AKpanel] Generated initial root panel password in %s", secretPassFile)
	}

	hash, err := bcryptHash(pass)
	if err != nil {
		return
	}
	data := RootAuthData{Username: "root", Hash: hash, UpdatedAt: time.Now().Format(time.RFC3339)}
	bytes, _ := json.MarshalIndent(data, "", "  ")
	_ = os.WriteFile(s.authFile, bytes, 0600)
}

func (s *AuthService) getRootData() (*RootAuthData, error) {
	content, err := os.ReadFile(s.authFile)
	if err != nil {
		return nil, err
	}
	var data RootAuthData
	if err := json.Unmarshal(content, &data); err != nil {
		return nil, err
	}
	return &data, nil
}

func (s *AuthService) saveRootData(data *RootAuthData) error {
	bytes, _ := json.MarshalIndent(data, "", "  ")
	return os.WriteFile(s.authFile, bytes, 0600)
}

// Authenticate verifies root credentials and returns a signed admin token.
func (s *AuthService) Authenticate(username, password string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := s.getRootData()
	if err != nil {
		return "", fmt.Errorf("authentication system uninitialized")
	}

	inputUser := strings.TrimSpace(strings.ToLower(username))
	rootUser := strings.TrimSpace(strings.ToLower(data.Username))
	validUser := (inputUser == rootUser) || (rootUser == "root" && inputUser == "admin")

	ok, upgrade := verifyRoot(data, password)
	if !validUser || !ok {
		return "", fmt.Errorf("invalid root credentials")
	}
	if upgrade {
		if h, err := bcryptHash(password); err == nil {
			data.Hash = h
			data.Salt = ""
			_ = s.saveRootData(data)
		}
	}

	return s.IssueToken(data.Username, "root_admin", TokenScopeAdmin, AdminTokenTTL)
}

// ChangePassword updates root password and invalidates every previously issued admin token.
func (s *AuthService) ChangePassword(oldPassword, newPassword string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(newPassword) < 10 {
		return fmt.Errorf("password must be at least 10 characters")
	}

	data, err := s.getRootData()
	if err != nil {
		return err
	}
	if ok, _ := verifyRoot(data, oldPassword); !ok {
		return fmt.Errorf("current root password is incorrect")
	}

	hash, err := bcryptHash(newPassword)
	if err != nil {
		return err
	}
	data.Hash = hash
	data.Salt = ""
	data.UpdatedAt = time.Now().Format(time.RFC3339)
	data.TokensValidAfter = time.Now().Unix()

	// Sync password with the Linux root user via stdin (no shell involved).
	chCmd := exec.Command("chpasswd")
	chCmd.Stdin = strings.NewReader(fmt.Sprintf("root:%s\n", newPassword))
	_ = chCmd.Run()

	return s.saveRootData(data)
}

func b64(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func (s *AuthService) sign(toSign string) string {
	mac := hmac.New(sha256.New, s.secretKey)
	mac.Write([]byte(toSign))
	return b64(mac.Sum(nil))
}

// IssueToken signs an HS256 JWT bound to a panel scope.
func (s *AuthService) IssueToken(username, role, scope string, ttl time.Duration) (string, error) {
	now := time.Now()
	header := b64([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payloadBytes, err := json.Marshal(map[string]any{
		"sub":      username,
		"username": username,
		"role":     role,
		"scope":    scope,
		"jti":      randomHex(16),
		"iat":      now.Unix(),
		"exp":      now.Add(ttl).Unix(),
		"iss":      tokenIssuer,
	})
	if err != nil {
		return "", err
	}
	toSign := header + "." + b64(payloadBytes)
	return toSign + "." + s.sign(toSign), nil
}

func claimInt(claims map[string]any, key string) (int64, bool) {
	v, ok := claims[key].(float64)
	return int64(v), ok
}

// parse verifies signature, issuer, expiry and revocation. It does not check scope.
func (s *AuthService) parse(tokenStr string) (map[string]any, bool) {
	tokenStr = strings.TrimSpace(strings.TrimPrefix(tokenStr, "Bearer "))
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, false
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, false
	}
	var header map[string]any
	if json.Unmarshal(headerBytes, &header) != nil || header["alg"] != "HS256" {
		return nil, false
	}

	expected := s.sign(parts[0] + "." + parts[1])
	if !hmac.Equal([]byte(parts[2]), []byte(expected)) {
		return nil, false
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, false
	}
	var claims map[string]any
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, false
	}
	if claims["iss"] != tokenIssuer {
		return nil, false
	}
	exp, ok := claimInt(claims, "exp")
	if !ok || exp < time.Now().Unix() {
		return nil, false
	}
	if jti, _ := claims["jti"].(string); jti == "" || s.isRevoked(jti) {
		return nil, false
	}
	return claims, true
}

// ValidateScoped validates a token and requires it to belong to the given panel scope.
func (s *AuthService) ValidateScoped(tokenStr, scope string) (map[string]any, bool) {
	claims, ok := s.parse(tokenStr)
	if !ok || claims["scope"] != scope {
		return nil, false
	}
	if scope == TokenScopeAdmin {
		if claims["role"] != "root_admin" {
			return nil, false
		}
		iat, _ := claimInt(claims, "iat")
		s.mu.RLock()
		data, err := s.getRootData()
		s.mu.RUnlock()
		if err != nil || iat < data.TokensValidAfter {
			return nil, false
		}
	}
	return claims, true
}

// ValidateToken validates an admin (root) token.
func (s *AuthService) ValidateToken(tokenStr string) (map[string]any, bool) {
	return s.ValidateScoped(tokenStr, TokenScopeAdmin)
}

// Revoke blacklists a token until it would have expired anyway (used by logout).
func (s *AuthService) Revoke(tokenStr string) {
	claims, ok := s.parse(tokenStr)
	if !ok {
		return
	}
	jti, _ := claims["jti"].(string)
	exp, _ := claimInt(claims, "exp")
	s.revokedMu.Lock()
	defer s.revokedMu.Unlock()
	now := time.Now().Unix()
	for k, e := range s.revoked {
		if e < now {
			delete(s.revoked, k)
		}
	}
	s.revoked[jti] = exp
}

func (s *AuthService) isRevoked(jti string) bool {
	s.revokedMu.Lock()
	defer s.revokedMu.Unlock()
	_, ok := s.revoked[jti]
	return ok
}
