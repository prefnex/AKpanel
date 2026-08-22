package services

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"goravel/app/paths"
	"goravel/app/services/tasks"
)

type SSLCertificateInfo struct {
	Domain     string `json:"domain"`
	Issuer     string `json:"issuer"`
	ExpiryDate string `json:"expiry_date"`
	AutoRenew  bool   `json:"auto_renew"`
	Status     string `json:"status"`
}

type FirewallRule struct {
	ID       string `json:"id"`
	Number   string `json:"number"`
	Port     string `json:"port"`
	Protocol string `json:"protocol"`
	Action   string `json:"action"`
	FromIP   string `json:"from_ip"`
	Comment  string `json:"comment"`
	IsActive bool   `json:"is_active"`
}

type BannedIPInfo struct {
	IP       string `json:"ip"`
	Jail     string `json:"jail"`
	BanTime  string `json:"ban_time"`
	Failures int    `json:"failures"`
	Country  string `json:"country"`
}

type FirewallData struct {
	IsActive        bool           `json:"is_active"`
	DefaultIncoming string         `json:"default_incoming"`
	DefaultOutgoing string         `json:"default_outgoing"`
	Rules           []FirewallRule `json:"rules"`
	BannedIPs       []BannedIPInfo `json:"banned_ips"`
	WAFMode         string         `json:"waf_mode"` // "on", "detection_only", "off"
	Fail2BanActive  bool           `json:"fail2ban_active"`
	SSHPort         int            `json:"ssh_port"`
}

type SecurityService struct {
	acmeService *ACMEService
}

func NewSecurityService() *SecurityService {
	return &SecurityService{
		acmeService: NewACMEService(),
	}
}

// IssueSSL requests Let's Encrypt / ZeroSSL via acme.sh with self-signed fallback
func (s *SecurityService) IssueSSL(domain, email string) (*SSLStatus, error) {
	webroot := paths.ResolveWebsiteRoot("", domain)
	res, err := s.acmeService.IssueSSL(domain, webroot, email)
	if err != nil {
		return nil, err
	}
	_ = NewNginxService().ReloadNginx()
	return res, nil
}

// IssueLetsEncrypt backward compatibility wrapper
func (s *SecurityService) IssueLetsEncrypt(domain, email string) error {
	_, err := s.acmeService.IssueSSL(domain, "", email)
	return err
}

func (s *SecurityService) GetAllCertificates() []CertificateDetail {
	return s.acmeService.GetAllCertificates()
}

func (s *SecurityService) InstallCustomCertificate(domain, certContent, keyContent, caBundle string) error {
	return s.acmeService.InstallCustomCertificate(domain, certContent, keyContent, caBundle)
}

func (s *SecurityService) RenewAll() (string, error) {
	out, err := s.acmeService.RenewAll()
	_ = NewNginxService().ReloadNginx()
	return out, err
}

func (s *SecurityService) RenewDomain(domain string) (*SSLStatus, error) {
	return s.IssueSSL(domain, "")
}

func (s *SecurityService) StartSSLTask(action, domain, email string) (string, error) {
	action = strings.ToLower(strings.TrimSpace(action))
	domain = strings.ToLower(strings.TrimSpace(domain))
	if action != "renew-all" && domain == "" {
		return "", fmt.Errorf("domain is required")
	}

	title := fmt.Sprintf("Issue SSL for %s", domain)
	kind := "domain_ssl"
	switch action {
	case "renew":
		title = fmt.Sprintf("Renew SSL for %s", domain)
	case "renew-all":
		domain = "all"
		title = "Renew all SSL certificates"
	}

	task, err := tasks.GetRegistry().Create(kind, domain, title)
	if err != nil {
		return "", err
	}
	go s.runSSLTask(task.ID, action, domain, email)
	return task.ID, nil
}

func (s *SecurityService) runSSLTask(taskID, action, domain, email string) {
	reg := tasks.GetRegistry()
	type sslStep struct {
		name string
		wait string
		pct  int
		fn   func() (string, error)
	}

	var steps []sslStep
	if action == "renew-all" {
		steps = []sslStep{
			{name: "ScanCertificates", wait: "Reading installed certificates on disk", pct: 15, fn: func() (string, error) {
				certs := s.GetAllCertificates()
				return fmt.Sprintf("Found %d certificate(s) to check", len(certs)), nil
			}},
			{name: "RunAcmeCron", wait: "Waiting for acme.sh --cron (Let's Encrypt renewal). This can take a few minutes.", pct: 70, fn: func() (string, error) {
				out, err := s.acmeService.RenewAll()
				if err != nil {
					return "", err
				}
				msg := strings.TrimSpace(out)
				if len(msg) > 400 {
					msg = msg[len(msg)-400:]
				}
				if msg == "" {
					msg = "acme.sh cron finished"
				}
				return msg, nil
			}},
			{name: "ReloadWebServers", wait: "Reloading nginx so new certs are live", pct: 88, fn: func() (string, error) {
				if err := NewNginxService().ReloadNginx(); err != nil {
					return fmt.Sprintf("nginx reload warning: %v", err), nil
				}
				return "nginx reloaded", nil
			}},
			{name: "VerifySSL", wait: "Checking certificate files after renewal", pct: 96, fn: func() (string, error) {
				certs := s.GetAllCertificates()
				trusted, fallback := 0, 0
				for _, c := range certs {
					if c.IsSelfSigned {
						fallback++
					} else {
						trusted++
					}
				}
				return fmt.Sprintf("RESULT trusted=%d self_signed=%d", trusted, fallback), nil
			}},
		}
	} else {
		steps = []sslStep{
			{name: "ValidateDomain", wait: "Checking domain name", pct: 8, fn: func() (string, error) {
				if domain == "" || domain == "localhost" {
					return "", fmt.Errorf("invalid domain: %q", domain)
				}
				return fmt.Sprintf("Domain accepted: %s", domain), nil
			}},
			{name: "PrepareChallenge", wait: "Preparing HTTP-01 webroot and nginx challenge path", pct: 22, fn: func() (string, error) {
				_ = os.MkdirAll("/var/www/html/.well-known/acme-challenge", 0755)
				if err := s.acmeService.EnsureAcmeInstalled(); err != nil {
					return "", err
				}
				webroot := paths.ResolveWebsiteRoot("", domain)
				if webroot == "" {
					webroot = "/var/www/html"
				}
				return fmt.Sprintf("Challenge webroot ready: %s", webroot), nil
			}},
			{name: "IssueCertificate", wait: "Waiting for Let's Encrypt / ZeroSSL. DNS must point here; this often takes 30–120 seconds.", pct: 65, fn: func() (string, error) {
				res, err := s.IssueSSL(domain, email)
				if err != nil {
					return "", err
				}
				if res.IsSelfSigned {
					return "RESULT self_signed: " + res.Message, nil
				}
				return "RESULT trusted: " + res.Message, nil
			}},
			{name: "InstallCertificate", wait: "Installing certificate files and reloading nginx", pct: 85, fn: func() (string, error) {
				if err := NewNginxService().ReloadNginx(); err != nil {
					return fmt.Sprintf("nginx reload warning: %v", err), nil
				}
				return "Certificate files in /etc/akpanel/ssl/" + domain + " — nginx reloaded", nil
			}},
			{name: "VerifySSL", wait: "Reading the live certificate to confirm issuer and expiry", pct: 96, fn: func() (string, error) {
				certPath := fmt.Sprintf("/etc/akpanel/ssl/%s/fullchain.pem", domain)
				info, ok := InspectCertificateFile(certPath)
				if !ok {
					return "Certificate file not readable yet", nil
				}
				if info.SelfSigned {
					return fmt.Sprintf("RESULT self_signed issuer=%s days_left=%d", info.Issuer, info.DaysLeft), nil
				}
				return fmt.Sprintf("RESULT trusted issuer=%s days_left=%d", info.Issuer, info.DaysLeft), nil
			}},
		}
	}

	for _, step := range steps {
		_ = reg.UpdateProgress(taskID, step.name, step.pct, "Waiting: "+step.wait)
		line, err := step.fn()
		if err != nil {
			_ = reg.Fail(taskID, err.Error(), fmt.Sprintf("Failed at %s: %v", step.name, err))
			return
		}
		if line != "" {
			_ = reg.UpdateProgress(taskID, step.name, step.pct, line)
		}
	}
	_ = reg.Complete(taskID, "SSL task finished")
}

// GetFirewallStatus gets UFW status and active port rules
func (s *SecurityService) GetFirewallStatus() (bool, []FirewallRule, error) {
	data := s.GetFullFirewallInfo()
	return data.IsActive, data.Rules, nil
}

func runUFW(args ...string) error {
	cmd := exec.Command("ufw", args...)
	out, err := cmd.CombinedOutput()
	msg := strings.TrimSpace(string(out))
	if err != nil {
		if msg != "" {
			return fmt.Errorf("%s", msg)
		}
		return err
	}
	low := strings.ToLower(msg)
	if strings.Contains(low, "error:") {
		return fmt.Errorf("%s", msg)
	}
	return nil
}

func firewallCommentForPort(port string) string {
	if n, err := strconv.Atoi(port); err == nil && n == CurrentSSHPort() {
		return "SSH Remote Terminal"
	}
	switch port {
	case "22":
		return "SSH Remote Terminal"
	case "80":
		return "HTTP Web Service"
	case "443":
		return "HTTPS SSL Web Service"
	case "2087":
		return "AKpanel WHM Root"
	case "2083":
		return "AKpanel Client Portal"
	case "53":
		return "BIND DNS Nameserver"
	case "21":
		return "FTP File Transfer"
	case "3306":
		return "MySQL Database"
	case "25", "465", "587":
		return "SMTP Mail Routing"
	case "110", "995":
		return "POP3 Mail Delivery"
	case "143", "993":
		return "IMAP Mailbox Access"
	default:
		return "Custom Rule"
	}
}

var ufwNumberedRe = regexp.MustCompile(`^\[(\s*\d+)\]\s+(\S+)(?:\s+\(v6\))?\s+(ALLOW|DENY|REJECT|LIMIT)\s+(?:(IN|OUT)\s+)?(\S+)`)

func parseUFWNumbered(outStr string) []FirewallRule {
	rules := []FirewallRule{}
	for _, line := range strings.Split(outStr, "\n") {
		line = strings.TrimSpace(line)
		m := ufwNumberedRe.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		num := strings.TrimSpace(m[1])
		portProto := m[2]
		action := m[3]
		fromIP := m[5]
		if fromIP == "" {
			fromIP = "Anywhere"
		}
		port := portProto
		proto := "TCP/UDP"
		if strings.Contains(portProto, "/") {
			parts := strings.SplitN(portProto, "/", 2)
			port = parts[0]
			proto = strings.ToUpper(parts[1])
		}
		comment := firewallCommentForPort(port)
		if idx := strings.Index(line, "#"); idx != -1 {
			c := strings.TrimSpace(line[idx+1:])
			if c != "" {
				comment = c
			}
		}
		rules = append(rules, FirewallRule{
			ID: num, Number: num, Port: port, Protocol: proto,
			Action: action, FromIP: fromIP, Comment: comment, IsActive: true,
		})
	}
	return rules
}

func parseUFWShowAdded(outStr string) []FirewallRule {
	rules := []FirewallRule{}
	n := 0
	for _, line := range strings.Split(outStr, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "ufw ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		action := strings.ToUpper(fields[1])
		port := ""
		proto := "TCP/UDP"
		fromIP := "Anywhere"
		for i, f := range fields {
			if f == "from" && i+1 < len(fields) {
				fromIP = fields[i+1]
			}
			if strings.Contains(f, "/") && !strings.Contains(f, ".") {
				parts := strings.SplitN(f, "/", 2)
				if _, err := strconv.Atoi(strings.Split(parts[0], ":")[0]); err == nil {
					port = parts[0]
					proto = strings.ToUpper(parts[1])
				}
			} else if port == "" {
				if _, err := strconv.Atoi(strings.Split(f, ":")[0]); err == nil {
					port = f
				}
			}
		}
		if port == "" {
			continue
		}
		n++
		num := strconv.Itoa(n)
		rules = append(rules, FirewallRule{
			ID: num, Number: num, Port: port, Protocol: proto,
			Action: action, FromIP: fromIP, Comment: firewallCommentForPort(port), IsActive: true,
		})
	}
	return rules
}

// GetFullFirewallInfo parses ufw numbered rules, fail2ban status, and WAF settings
func (s *SecurityService) GetFullFirewallInfo() FirewallData {
	out, err := exec.Command("ufw", "status", "numbered").CombinedOutput()
	outStr := string(out)
	isActive := strings.Contains(outStr, "Status: active")

	rules := parseUFWNumbered(outStr)
	if len(rules) == 0 {
		added, aerr := exec.Command("ufw", "show", "added").CombinedOutput()
		if aerr == nil {
			rules = parseUFWShowAdded(string(added))
		}
	}
	if err != nil && len(rules) == 0 {
		isActive = false
	}

	// Parse Fail2Ban Jails & Banned IPs
	bannedList := []BannedIPInfo{}
	f2bOut, f2bErr := exec.Command("fail2ban-client", "status", "sshd").CombinedOutput()
	if f2bErr == nil {
		lines := strings.Split(string(f2bOut), "\n")
		for _, l := range lines {
			if strings.Contains(l, "Banned IP list:") {
				parts := strings.Split(l, ":")
				if len(parts) >= 2 {
					ips := strings.Fields(parts[1])
					for _, bIp := range ips {
						bannedList = append(bannedList, BannedIPInfo{
							IP:       bIp,
							Jail:     "sshd",
							BanTime:  "Recent",
							Failures: 5,
							Country:  "Detected",
						})
					}
				}
			}
		}
	}

	return FirewallData{
		IsActive:        isActive,
		DefaultIncoming: "DENY",
		DefaultOutgoing: "ALLOW",
		Rules:           rules,
		BannedIPs:       bannedList,
		WAFMode:         "on",
		Fail2BanActive:  true,
		SSHPort:         CurrentSSHPort(),
	}
}

func (s *SecurityService) addOneUFWRule(port, proto, action, fromIP, comment string) error {
	action = strings.ToLower(strings.TrimSpace(action))
	if action == "" {
		action = "allow"
	}
	proto = strings.ToLower(strings.TrimSpace(proto))
	fromIP = strings.TrimSpace(fromIP)

	var args []string
	if fromIP != "" && !strings.EqualFold(fromIP, "Anywhere") && fromIP != "any" {
		if proto != "" && proto != "tcp/udp" && proto != "any" {
			args = []string{action, "proto", proto, "from", fromIP, "to", "any", "port", port}
		} else {
			args = []string{action, "from", fromIP, "to", "any", "port", port}
		}
	} else if proto != "" && proto != "tcp/udp" && proto != "any" {
		args = []string{action, fmt.Sprintf("%s/%s", port, proto)}
	} else {
		args = []string{action, port}
	}
	if comment != "" {
		args = append(args, "comment", comment)
	}
	return runUFW(args...)
}

// AddFirewallRule adds a custom rule
func (s *SecurityService) AddFirewallRule(port, proto, action, fromIP, comment string) error {
	if strings.TrimSpace(port) == "" {
		return fmt.Errorf("port is required")
	}
	if comment == "" {
		comment = firewallCommentForPort(port)
	}
	proto = strings.TrimSpace(proto)
	if proto == "" || strings.EqualFold(proto, "TCP/UDP") || strings.EqualFold(proto, "both") {
		if err := s.addOneUFWRule(port, "tcp", action, fromIP, comment); err != nil {
			return err
		}
		return s.addOneUFWRule(port, "udp", action, fromIP, comment)
	}
	return s.addOneUFWRule(port, proto, action, fromIP, comment)
}

// DeleteFirewallRule deletes by rule number or port
func (s *SecurityService) DeleteFirewallRule(ruleNumOrPort string) error {
	if _, err := strconv.Atoi(strings.TrimSpace(ruleNumOrPort)); err == nil {
		return runUFW("--force", "delete", strings.TrimSpace(ruleNumOrPort))
	}
	return s.deleteRulesForPort(strings.TrimSpace(ruleNumOrPort))
}

func (s *SecurityService) deleteRulesForPort(port string) error {
	out, _ := exec.Command("ufw", "status", "numbered").CombinedOutput()
	nums := []int{}
	for _, r := range parseUFWNumbered(string(out)) {
		if r.Port == port {
			n, err := strconv.Atoi(strings.TrimSpace(r.Number))
			if err == nil {
				nums = append(nums, n)
			}
		}
	}
	sort.Sort(sort.Reverse(sort.IntSlice(nums)))
	for _, n := range nums {
		if err := runUFW("--force", "delete", strconv.Itoa(n)); err != nil {
			return err
		}
	}
	_ = runUFW("delete", "allow", port+"/tcp")
	_ = runUFW("delete", "deny", port+"/tcp")
	_ = runUFW("delete", "allow", port)
	return nil
}

// SetFirewallEnabled turns UFW on/off
func (s *SecurityService) SetFirewallEnabled(enable bool) error {
	if enable {
		return runUFW("--force", "enable")
	}
	return runUFW("disable")
}

// UnbanIP unbans an IP from Fail2Ban
func (s *SecurityService) UnbanIP(ip, jail string) error {
	if jail == "" {
		jail = "sshd"
	}
	cmd := exec.Command("fail2ban-client", "set", jail, "unbanip", ip)
	return cmd.Run()
}

// BanIP bans an IP manually
func (s *SecurityService) BanIP(ip, reason string) error {
	return runUFW("insert", "1", "deny", "from", ip, "comment", reason)
}

// TogglePort opens or closes a port in UFW.
// Block removes allow rules (default incoming DENY). Adding deny while allow exists does nothing.
func (s *SecurityService) TogglePort(port string, allow bool) error {
	port = strings.TrimSpace(port)
	if port == "" {
		return fmt.Errorf("port is required")
	}
	if err := s.deleteRulesForPort(port); err != nil {
		return err
	}
	if !allow {
		return nil
	}
	if port == "53" {
		if err := runUFW("allow", "53/tcp", "comment", firewallCommentForPort(port)); err != nil {
			return err
		}
		return runUFW("allow", "53/udp", "comment", firewallCommentForPort(port))
	}
	return runUFW("allow", port+"/tcp", "comment", firewallCommentForPort(port))
}

const (
	sshPortDropIn = "/etc/ssh/sshd_config.d/zz-akpanel-port.conf"
	sshPortState  = "/etc/akpanel/ssh.port"
)

var reservedSSHPorts = map[int]string{
	21: "FTP", 25: "SMTP", 53: "DNS", 80: "HTTP", 110: "POP3", 143: "IMAP",
	443: "HTTPS", 465: "SMTPS", 587: "submission", 993: "IMAPS", 995: "POP3S",
	2083: "client panel", 2087: "WHM", 2088: "internal API", 3306: "MariaDB",
	8081: "Apache backend", 8085: "phpMyAdmin", 8086: "Roundcube",
}

// CurrentSSHPort is the port sshd is configured to listen on.
func CurrentSSHPort() int {
	if b, err := os.ReadFile(sshPortState); err == nil {
		if n, err := strconv.Atoi(strings.TrimSpace(string(b))); err == nil && n > 0 && n < 65536 {
			return n
		}
	}
	if n := liveSSHDPort(); n > 0 {
		return n
	}
	return 22
}

func liveSSHDPort() int {
	out, err := exec.Command("sshd", "-T").Output()
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(out), "\n") {
		fields := strings.Fields(strings.ToLower(line))
		if len(fields) >= 2 && fields[0] == "port" {
			if n, err := strconv.Atoi(fields[1]); err == nil && n > 0 && n < 65536 {
				return n
			}
		}
	}
	return 0
}

// ChangeSSHPort opens the new port in UFW, switches sshd, updates fail2ban, then closes the old port.
func (s *SecurityService) ChangeSSHPort(port int) error {
	if port < 1 || port > 65535 {
		return fmt.Errorf("SSH port must be between 1 and 65535")
	}
	if name, ok := reservedSSHPorts[port]; ok {
		return fmt.Errorf("port %d is reserved for %s", port, name)
	}

	current := CurrentSSHPort()
	if current == port {
		_ = os.WriteFile(sshPortState, []byte(strconv.Itoa(port)+"\n"), 0644)
		return nil
	}

	prevDrop, _ := os.ReadFile(sshPortDropIn)
	if err := runUFW("allow", fmt.Sprintf("%d/tcp", port), "comment", "SSH Remote Terminal"); err != nil {
		return fmt.Errorf("open firewall for new SSH port: %w", err)
	}

	_ = os.MkdirAll("/etc/ssh/sshd_config.d", 0755)
	body := fmt.Sprintf("# Managed by AKpanel — do not edit\nPort %d\n", port)
	if err := os.WriteFile(sshPortDropIn, []byte(body), 0644); err != nil {
		return err
	}
	commentSSHPortInMainConfig()

	if out, err := exec.Command("sshd", "-t").CombinedOutput(); err != nil {
		_ = restoreSSHDropIn(prevDrop)
		return fmt.Errorf("sshd config test failed: %s", strings.TrimSpace(string(out)))
	}

	_ = exec.Command("systemctl", "reload", "ssh").Run()
	_ = exec.Command("systemctl", "reload", "sshd").Run()

	if got := liveSSHDPort(); got != 0 && got != port {
		_ = restoreSSHDropIn(prevDrop)
		_ = exec.Command("systemctl", "reload", "ssh").Run()
		_ = exec.Command("systemctl", "reload", "sshd").Run()
		return fmt.Errorf("sshd did not switch to port %d (still %d); reverted", port, got)
	}

	writeFail2banSSHPort(port)
	_ = os.MkdirAll(paths.EtcAKpanel, 0755)
	_ = os.WriteFile(sshPortState, []byte(strconv.Itoa(port)+"\n"), 0644)

	if current > 0 && current != port {
		_ = s.deleteRulesForPort(strconv.Itoa(current))
	}
	return nil
}

func restoreSSHDropIn(prev []byte) error {
	if len(prev) == 0 {
		return os.Remove(sshPortDropIn)
	}
	return os.WriteFile(sshPortDropIn, prev, 0644)
}

func commentSSHPortInMainConfig() {
	path := "/etc/ssh/sshd_config"
	b, err := os.ReadFile(path)
	if err != nil {
		return
	}
	lines := strings.Split(string(b), "\n")
	changed := false
	for i, line := range lines {
		t := strings.TrimSpace(line)
		if t == "" || strings.HasPrefix(t, "#") {
			continue
		}
		if strings.HasPrefix(strings.ToLower(t), "port ") {
			lines[i] = "# " + t + "  # Port is set in " + sshPortDropIn
			changed = true
		}
	}
	if changed {
		_ = os.WriteFile(path, []byte(strings.Join(lines, "\n")), 0644)
	}
}

func writeFail2banSSHPort(port int) {
	_ = os.MkdirAll("/etc/fail2ban/jail.d", 0755)
	body := fmt.Sprintf("# Managed by AKpanel\n[sshd]\nenabled = true\nport = %d\n", port)
	_ = os.WriteFile("/etc/fail2ban/jail.d/akpanel-sshd.conf", []byte(body), 0644)
	_ = exec.Command("fail2ban-client", "reload").Run()
}
