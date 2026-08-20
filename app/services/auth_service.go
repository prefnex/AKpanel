package services

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"goravel/app/paths"
)

type RootAuthData struct {
	Username  string `json:"username"`
	Salt      string `json:"salt"`
	Hash      string `json:"hash"`
	UpdatedAt string `json:"updated_at"`
}

type AuthService struct {
	mu         sync.RWMutex
	authFile   string
	secretFile string
	secretKey  []byte
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
		}
		s.initSecretKey()
		s.initDefaultRoot()
		authServiceInstance = s
	})
	return authServiceInstance
}

func (s *AuthService) initSecretKey() {
	if content, err := os.ReadFile(s.secretFile); err == nil && len(content) >= 32 {
		s.secretKey = content
		return
	}
	// Generate random 64-byte secret key
	buf := make([]byte, 64)
	_, _ = rand.Read(buf)
	keyHex := hex.EncodeToString(buf)
	_ = os.WriteFile(s.secretFile, []byte(keyHex), 0600)
	s.secretKey = []byte(keyHex)
}

func (s *AuthService) hashPassword(password, salt string) string {
	h := sha256.New()
	h.Write([]byte(password + ":" + salt + ":akpanel_root_pepper"))
	return hex.EncodeToString(h.Sum(nil))
}

func (s *AuthService) initDefaultRoot() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.authFile); os.IsNotExist(err) {
		salt := hex.EncodeToString([]byte(fmt.Sprintf("%d", time.Now().UnixNano())))
		defaultPass := "admin123456"

		// Check if a secret password was provisioned via /etc/akpanel/secrets/admin_root
		secretPassFile := filepath.Join(paths.EtcAKpanelSecrets, "admin_root")
		if secretBytes, err := os.ReadFile(secretPassFile); err == nil {
			if t := strings.TrimSpace(string(secretBytes)); t != "" {
				defaultPass = t
			}
		}

		data := RootAuthData{
			Username:  "root",
			Salt:      salt,
			Hash:      s.hashPassword(defaultPass, salt),
			UpdatedAt: time.Now().Format(time.RFC3339),
		}
		bytes, _ := json.MarshalIndent(data, "", "  ")
		_ = os.WriteFile(s.authFile, bytes, 0600)
	}
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

// Authenticate verifies root credentials and generates a secure JWT
func (s *AuthService) Authenticate(username, password string) (string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := s.getRootData()
	if err != nil {
		return "", fmt.Errorf("authentication system uninitialized")
	}

	// Allow login with 'root' or 'admin' if username matches or if root
	inputUser := strings.TrimSpace(strings.ToLower(username))
	rootUser := strings.TrimSpace(strings.ToLower(data.Username))

	validUser := (inputUser == rootUser) || (rootUser == "root" && inputUser == "admin")
	if !validUser {
		return "", fmt.Errorf("invalid root credentials")
	}

	inputHash := s.hashPassword(password, data.Salt)
	if inputHash != data.Hash {
		return "", fmt.Errorf("invalid root credentials")
	}

	return s.generateJWT(data.Username)
}

// ChangePassword updates root user password
func (s *AuthService) ChangePassword(oldPassword, newPassword string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if len(newPassword) < 6 {
		return fmt.Errorf("password must be at least 6 characters")
	}

	data, err := s.getRootData()
	if err != nil {
		return err
	}

	if s.hashPassword(oldPassword, data.Salt) != data.Hash {
		return fmt.Errorf("current root password is incorrect")
	}

	newSalt := hex.EncodeToString([]byte(fmt.Sprintf("%d", time.Now().UnixNano())))
	data.Salt = newSalt
	data.Hash = s.hashPassword(newPassword, newSalt)
	data.UpdatedAt = time.Now().Format(time.RFC3339)

	// Sync password safely with real Linux system root user via Stdin (no bash -c injection risk)
	chCmd := exec.Command("chpasswd")
	chCmd.Stdin = strings.NewReader(fmt.Sprintf("root:%s\n", newPassword))
	_ = chCmd.Run()

	bytes, _ := json.MarshalIndent(data, "", "  ")
	return os.WriteFile(s.authFile, bytes, 0600)
}

// generateJWT signs a lightweight, secure HS256 JWT
func (s *AuthService) generateJWT(username string) (string, error) {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))

	exp := time.Now().Add(24 * time.Hour).Unix()
	payloadMap := map[string]any{
		"sub":      "root",
		"username": username,
		"role":     "root_admin",
		"exp":      exp,
		"iat":      time.Now().Unix(),
		"iss":      "AKpanel-Root-Authority",
	}
	payloadBytes, _ := json.Marshal(payloadMap)
	payload := base64.RawURLEncoding.EncodeToString(payloadBytes)

	toSign := header + "." + payload
	mac := hmac.New(sha256.New, s.secretKey)
	mac.Write([]byte(toSign))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return toSign + "." + signature, nil
}

// ValidateToken decodes and checks token validity
func (s *AuthService) ValidateToken(tokenStr string) (map[string]any, bool) {
	tokenStr = strings.TrimPrefix(tokenStr, "Bearer ")
	tokenStr = strings.TrimSpace(tokenStr)
	parts := strings.Split(tokenStr, ".")
	if len(parts) != 3 {
		return nil, false
	}

	toSign := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, s.secretKey)
	mac.Write([]byte(toSign))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(parts[2]), []byte(expectedSig)) {
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

	// Check expiration
	if expVal, ok := claims["exp"]; ok {
		if expFloat, ok := expVal.(float64); ok {
			if int64(expFloat) < time.Now().Unix() {
				return nil, false // Expired
			}
		}
	}

	return claims, true
}
