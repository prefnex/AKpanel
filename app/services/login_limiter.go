package services

import (
	"strings"
	"sync"
	"time"
)

// LoginLimiter throttles brute-force attempts per (client IP, username) and per IP.
type LoginLimiter struct {
	mu       sync.Mutex
	failures map[string][]time.Time
}

const (
	loginWindow       = 15 * time.Minute
	maxFailsPerKey    = 5
	maxFailsPerIP     = 20
)

var (
	loginLimiter     *LoginLimiter
	loginLimiterOnce sync.Once
)

func GetLoginLimiter() *LoginLimiter {
	loginLimiterOnce.Do(func() {
		loginLimiter = &LoginLimiter{failures: map[string][]time.Time{}}
	})
	return loginLimiter
}

func limiterKeys(scope, ip, username string) (string, string) {
	return scope + "|" + ip + "|" + strings.ToLower(strings.TrimSpace(username)), scope + "|" + ip
}

func (l *LoginLimiter) recent(key string, now time.Time) []time.Time {
	var kept []time.Time
	for _, t := range l.failures[key] {
		if now.Sub(t) < loginWindow {
			kept = append(kept, t)
		}
	}
	if len(kept) == 0 {
		delete(l.failures, key)
	} else {
		l.failures[key] = kept
	}
	return kept
}

// Allowed reports whether another attempt may be made, and if not, how long to wait.
func (l *LoginLimiter) Allowed(scope, ip, username string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	userKey, ipKey := limiterKeys(scope, ip, username)
	for _, k := range []struct {
		key string
		max int
	}{{userKey, maxFailsPerKey}, {ipKey, maxFailsPerIP}} {
		if fails := l.recent(k.key, now); len(fails) >= k.max {
			return false, loginWindow - now.Sub(fails[0])
		}
	}
	return true, 0
}

func (l *LoginLimiter) Fail(scope, ip, username string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	userKey, ipKey := limiterKeys(scope, ip, username)
	l.failures[userKey] = append(l.recent(userKey, now), now)
	l.failures[ipKey] = append(l.recent(ipKey, now), now)
}

func (l *LoginLimiter) Success(scope, ip, username string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	userKey, _ := limiterKeys(scope, ip, username)
	delete(l.failures, userKey)
}
