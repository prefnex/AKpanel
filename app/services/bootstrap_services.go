package services

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"time"
)

// BootstrapPanelServices provisions everything the panel normally repairs lazily in
// background goroutines: the panel schema, Dovecot/Postfix wiring, Roundcube, phpMyAdmin
// and the two internal nginx listeners they are proxied to.
//
// The installer calls this synchronously (`akpanel --bootstrap-services`) so a freshly
// installed VPS can serve /webmail and /phpmyadmin on the very first click instead of
// returning 502 until the first panel boot happens to finish its goroutines.
func BootstrapPanelServices() error {
	steps := []struct {
		name string
		run  func() error
	}{
		{"panel database", func() error {
			EnsurePanelMariaDB()
			return nil
		}},
		{"dovecot auth", func() error {
			return GetMailAuthService().EnsureDovecotConfig()
		}},
		{"postfix virtual mailboxes", func() error {
			return GetMailAuthService().EnsurePostfixVirtualConfig()
		}},
		{"postfix identity and milters", func() error {
			GetMailAuthService().EnsureMailIdentity()
			NewMailPolicyService().ApplyAll()
			return nil
		}},
		{"sieve autoresponders", func() error {
			NewMailSieveService().RenderAll()
			return nil
		}},
		{"roundcube webmail", func() error {
			NewEmailService().EnsureRoundcubeWebmail()
			return nil
		}},
		{"phpmyadmin", func() error {
			NewDatabaseService().EnsurePhpMyAdminSetup()
			return nil
		}},
		{"internal listeners", func() error {
			nginx := NewNginxService()
			if err := nginx.EnsureRoundcubeListener(); err != nil {
				return err
			}
			return nginx.EnsurePhpMyAdminListener()
		}},
	}

	var firstErr error
	for _, step := range steps {
		if err := step.run(); err != nil {
			fmt.Fprintf(os.Stderr, "bootstrap: %s failed: %v\n", step.name, err)
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		fmt.Printf("bootstrap: %s ready\n", step.name)
	}

	for _, probe := range []struct {
		label string
		addr  string
		url   string
	}{
		{"roundcube", "127.0.0.1:8086", "http://127.0.0.1:8086/"},
		{"phpmyadmin", "127.0.0.1:8085", "http://127.0.0.1:8085/"},
	} {
		if err := waitForHTTP(probe.addr, probe.url, 20*time.Second); err != nil {
			fmt.Fprintf(os.Stderr, "bootstrap: %s backend not answering on %s: %v\n", probe.label, probe.addr, err)
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		fmt.Printf("bootstrap: %s backend answering on %s\n", probe.label, probe.addr)
	}
	return firstErr
}

func waitForHTTP(addr, url string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	client := &http.Client{Timeout: 3 * time.Second}
	var lastErr error
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
		if err != nil {
			lastErr = err
			time.Sleep(500 * time.Millisecond)
			continue
		}
		_ = conn.Close()

		resp, err := client.Get(url)
		if err != nil {
			lastErr = err
			time.Sleep(500 * time.Millisecond)
			continue
		}
		_ = resp.Body.Close()
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("http status %d", resp.StatusCode)
			time.Sleep(500 * time.Millisecond)
			continue
		}
		return nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("timed out")
	}
	return lastErr
}
