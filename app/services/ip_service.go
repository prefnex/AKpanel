package services

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// NormalizeIPAddress strips UI labels like "(Shared)" and returns a bare IPv4/IPv6 address.
func NormalizeIPAddress(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if idx := strings.Index(raw, " ("); idx > 0 {
		raw = strings.TrimSpace(raw[:idx])
	}
	if fields := strings.Fields(raw); len(fields) > 0 {
		raw = fields[0]
	}
	if ip := net.ParseIP(raw); ip != nil {
		return ip.String()
	}
	return raw
}

type IPAddressItem struct {
	ID          string `json:"id"`
	IP          string `json:"ip"`           // e.g. "167.233.222.45" or "2a01:4f8:..."
	Version     string `json:"version"`      // "IPv4" or "IPv6"
	Netmask     string `json:"netmask"`      // e.g. "255.255.255.0" or "/24" or "/64"
	CIDR        int    `json:"cidr"`         // e.g. 24, 64
	Gateway     string `json:"gateway"`      // e.g. "167.233.222.1"
	Interface   string `json:"interface"`    // e.g. "eth0", "ens3"
	Role        string `json:"role"`         // "main", "shared", "dedicated"
	AssignedTo  string `json:"assigned_to"`  // domain or username if dedicated
	AccountsNum int    `json:"accounts_num"` // number of hosting accounts using this IP
	DomainsNum  int    `json:"domains_num"`  // number of domains pointing to this IP
	IsBound     bool   `json:"is_bound"`     // bound to OS network interface
	IsPrimary   bool   `json:"is_primary"`   // primary server IP
	CreatedAt   string `json:"created_at"`
}

type IPPoolData struct {
	IPs       []IPAddressItem `json:"ips"`
	UpdatedAt string          `json:"updated_at"`
}

type IPService struct {
	mu       sync.RWMutex
	filePath string
}

var (
	ipServiceInstance *IPService
	ipOnce            sync.Once
)

func NewIPService() *IPService {
	ipOnce.Do(func() {
		_ = os.MkdirAll("/etc/akpanel", 0755)
		s := &IPService{
			filePath: "/etc/akpanel/ip_pool.json",
		}
		s.initPool()
		ipServiceInstance = s
	})
	return ipServiceInstance
}

func (s *IPService) initPool() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		detected := s.detectSystemIPsUnsafe()
		data := IPPoolData{
			IPs:       detected,
			UpdatedAt: time.Now().Format(time.RFC3339),
		}
		bytes, _ := json.MarshalIndent(data, "", "  ")
		_ = os.WriteFile(s.filePath, bytes, 0644)
	}
}

func (s *IPService) detectSystemIPsUnsafe() []IPAddressItem {
	var items []IPAddressItem
	interfaces, err := net.Interfaces()
	if err != nil {
		return s.defaultFallbackIPs()
	}

	primaryIPv4 := s.getPrimaryOutboundIP()
	idCounter := 1

	for _, iface := range interfaces {
		// Ignore loopback and down interfaces
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			var ip net.IP
			var mask net.IPMask
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
				mask = v.Mask
			case *net.IPAddr:
				ip = v.IP
				mask = ip.DefaultMask()
			}

			if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
				continue
			}

			ipStr := ip.String()
			isV4 := (ip.To4() != nil)
			version := "IPv6"
			if isV4 {
				version = "IPv4"
			}

			cidrSize, _ := mask.Size()
			netmaskStr := fmt.Sprintf("/%d", cidrSize)
			if isV4 && len(mask) == 4 {
				netmaskStr = fmt.Sprintf("%d.%d.%d.%d", mask[0], mask[1], mask[2], mask[3])
			}

			isPrimary := (ipStr == primaryIPv4)
			role := "shared"
			if isPrimary {
				role = "main"
			}

			items = append(items, IPAddressItem{
				ID:          fmt.Sprintf("ip_%d", idCounter),
				IP:          ipStr,
				Version:     version,
				Netmask:     netmaskStr,
				CIDR:        cidrSize,
				Gateway:     s.getDefaultGateway(iface.Name),
				Interface:   iface.Name,
				Role:        role,
				IsBound:     true,
				IsPrimary:   isPrimary,
				AccountsNum: 0,
				DomainsNum:  0,
				CreatedAt:   time.Now().Format(time.RFC3339),
			})
			idCounter++
		}
	}

	if len(items) == 0 {
		return s.defaultFallbackIPs()
	}
	return items
}

func (s *IPService) defaultFallbackIPs() []IPAddressItem {
	return []IPAddressItem{
		{
			ID:          "ip_1",
			IP:          "127.0.0.1",
			Version:     "IPv4",
			Netmask:     "255.255.255.0",
			CIDR:        24,
			Gateway:     "127.0.0.1",
			Interface:   "eth0",
			Role:        "main",
			IsBound:     true,
			IsPrimary:   true,
			AccountsNum: 1,
			DomainsNum:  1,
			CreatedAt:   time.Now().Format(time.RFC3339),
		},
	}
}

func (s *IPService) getPrimaryOutboundIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err == nil {
		defer conn.Close()
		localAddr := conn.LocalAddr().(*net.UDPAddr)
		return localAddr.IP.String()
	}
	cmd := exec.Command("bash", "-c", "hostname -I 2>/dev/null | awk '{print $1}'")
	if out, err := cmd.Output(); err == nil {
		ip := strings.TrimSpace(string(out))
		if ip != "" {
			return ip
		}
	}
	return "127.0.0.1"
}

func (s *IPService) getDefaultGateway(iface string) string {
	cmd := exec.Command("bash", "-c", fmt.Sprintf("ip route show dev %s default 2>/dev/null | awk '{print $3}'", iface))
	if out, err := cmd.Output(); err == nil {
		gw := strings.TrimSpace(string(out))
		if gw != "" {
			return gw
		}
	}
	return ""
}

// IPv6Capability describes what the host can actually do over IPv6. The panel uses it to
// decide whether to show IPv6 options at all: a server without a routed subnet must never
// be offered per-user address allocation.
type IPv6Capability struct {
	Available     bool   `json:"available"`      // host has a public IPv6 address
	PrimaryIP     string `json:"primary_ip"`     // the panel's own IPv6 address
	Subnet        string `json:"subnet"`         // e.g. "2a01:4f8:c014:6ffd::/64"
	PrefixLength  int    `json:"prefix_length"`  // e.g. 64
	Interface     string `json:"interface"`      // e.g. "eth0"
	CanAllocate   bool   `json:"can_allocate"`   // subnet is large enough to hand out addresses
	AllocatedNum  int    `json:"allocated_num"`  // addresses already handed to accounts
	DetectionNote string `json:"detection_note"` // human readable reason when unavailable
}

// DetectIPv6Capability inspects the live interfaces for a routable IPv6 address and the
// prefix it belongs to. Per-user addresses have to come out of this same prefix, otherwise
// they are not routed to the machine and the sites bound to them silently stop answering.
func (s *IPService) DetectIPv6Capability() IPv6Capability {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.detectIPv6CapabilityUnsafe()
}

func (s *IPService) detectIPv6CapabilityUnsafe() IPv6Capability {
	cap := IPv6Capability{DetectionNote: "no public IPv6 address found on any interface"}

	interfaces, err := net.Interfaces()
	if err != nil {
		cap.DetectionNote = "unable to read network interfaces"
		return cap
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipNet.IP
			if ip.To4() != nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsPrivate() {
				continue
			}

			prefixLen, _ := ipNet.Mask.Size()
			cap.Available = true
			cap.PrimaryIP = ip.String()
			cap.PrefixLength = prefixLen
			cap.Interface = iface.Name
			cap.Subnet = fmt.Sprintf("%s/%d", ip.Mask(ipNet.Mask).String(), prefixLen)
			cap.DetectionNote = ""

			// A /128 is a single address; anything /64 or shorter leaves room to allocate.
			cap.CanAllocate = prefixLen > 0 && prefixLen <= 112
			if !cap.CanAllocate {
				cap.DetectionNote = fmt.Sprintf("prefix /%d is a single address, per-user allocation needs /112 or larger", prefixLen)
			}
			if pool, err := s.readPoolUnsafe(); err == nil {
				for _, item := range pool.IPs {
					if item.Version == "IPv6" && item.Role == "dedicated" && item.AssignedTo != "" {
						cap.AllocatedNum++
					}
				}
			}
			return cap
		}
	}
	return cap
}

// AllocateUserIPv6 reserves the next free address from the server's own IPv6 prefix, binds
// it to the interface and records it in the pool. The panel's primary address and every
// already-assigned address are skipped so a hosting account can never take over the
// address the control panel itself answers on.
func (s *IPService) AllocateUserIPv6(username string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	capability := s.detectIPv6CapabilityUnsafe()
	if !capability.Available || !capability.CanAllocate {
		return "", fmt.Errorf("server has no allocatable IPv6 prefix")
	}

	_, subnet, err := net.ParseCIDR(capability.Subnet)
	if err != nil {
		return "", fmt.Errorf("unusable IPv6 subnet %q: %w", capability.Subnet, err)
	}

	pool, err := s.readPoolUnsafe()
	if err != nil {
		pool = IPPoolData{}
	}

	taken := map[string]bool{capability.PrimaryIP: true}
	for _, item := range pool.IPs {
		taken[item.IP] = true
		if item.Version == "IPv6" && item.AssignedTo == username && item.Role == "dedicated" {
			return item.IP, nil // idempotent: re-provisioning keeps the same address
		}
	}

	// Start at ::10 to leave the low addresses for gateways and infrastructure.
	base := subnet.IP.To16()
	for offset := 0x10; offset <= 0xffff; offset++ {
		candidate := make(net.IP, len(base))
		copy(candidate, base)
		candidate[14] = byte(offset >> 8)
		candidate[15] = byte(offset & 0xff)
		if !subnet.Contains(candidate) {
			break
		}
		addr := candidate.String()
		if taken[addr] {
			continue
		}

		cidr := fmt.Sprintf("%s/%d", addr, capability.PrefixLength)
		if out, err := exec.Command("ip", "-6", "addr", "add", cidr, "dev", capability.Interface).CombinedOutput(); err != nil {
			// "File exists" means the kernel already has it; treat anything else as fatal.
			if !strings.Contains(strings.ToLower(string(out)), "exists") {
				return "", fmt.Errorf("failed to bind %s: %v — %s", cidr, err, strings.TrimSpace(string(out)))
			}
		}

		pool.IPs = append(pool.IPs, IPAddressItem{
			ID:         fmt.Sprintf("ip6_%s", username),
			IP:         addr,
			Version:    "IPv6",
			Netmask:    fmt.Sprintf("/%d", capability.PrefixLength),
			CIDR:       capability.PrefixLength,
			Interface:  capability.Interface,
			Role:       "dedicated",
			AssignedTo: username,
			IsBound:    true,
			CreatedAt:  time.Now().Format(time.RFC3339),
		})
		if err := s.writePoolUnsafe(pool); err != nil {
			return "", err
		}
		return addr, nil
	}
	return "", fmt.Errorf("no free address left in %s", capability.Subnet)
}

// ReleaseUserIPv6 unbinds and forgets the dedicated IPv6 address of a deleted account.
func (s *IPService) ReleaseUserIPv6(username string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pool, err := s.readPoolUnsafe()
	if err != nil {
		return
	}
	kept := pool.IPs[:0]
	changed := false
	for _, item := range pool.IPs {
		if item.Version == "IPv6" && item.Role == "dedicated" && item.AssignedTo == username {
			cidr := fmt.Sprintf("%s/%d", item.IP, item.CIDR)
			_ = exec.Command("ip", "-6", "addr", "del", cidr, "dev", item.Interface).Run()
			changed = true
			continue
		}
		kept = append(kept, item)
	}
	if changed {
		pool.IPs = kept
		_ = s.writePoolUnsafe(pool)
	}
}

// GetIPs returns all configured IP addresses with usage count
func (s *IPService) GetIPs() ([]IPAddressItem, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := s.readPoolUnsafe()
	if err != nil {
		return nil, err
	}

	// Update account usage stats from users.json
	usersCountByIP := make(map[string]int)
	if uData, err := os.ReadFile("/etc/akpanel/users.json"); err == nil {
		var users []UserAccount
		if json.Unmarshal(uData, &users) == nil {
			for _, u := range users {
				cleanIP := NormalizeIPAddress(u.IPAddress)
				if cleanIP != "" {
					usersCountByIP[cleanIP]++
				}
			}
		}
	}

	for i := range data.IPs {
		data.IPs[i].AccountsNum = usersCountByIP[data.IPs[i].IP]
	}

	return data.IPs, nil
}

func (s *IPService) readPoolUnsafe() (IPPoolData, error) {
	var data IPPoolData
	content, err := os.ReadFile(s.filePath)
	if err != nil {
		return data, err
	}
	err = json.Unmarshal(content, &data)
	return data, err
}

func (s *IPService) writePoolUnsafe(data IPPoolData) error {
	data.UpdatedAt = time.Now().Format(time.RFC3339)
	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, bytes, 0644)
}

// AddIP adds an IPv4 or IPv6 address and binds it as an interface alias
func (s *IPService) AddIP(ip, netmask, gateway, iface, role, assignedTo string) (*IPAddressItem, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	ip = strings.TrimSpace(ip)
	if ip == "" {
		return nil, fmt.Errorf("IP address cannot be empty")
	}

	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return nil, fmt.Errorf("invalid IP address format '%s'", ip)
	}

	isV4 := (parsedIP.To4() != nil)
	version := "IPv6"
	defaultCIDR := 64
	if isV4 {
		version = "IPv4"
		defaultCIDR = 24
	}

	data, err := s.readPoolUnsafe()
	if err != nil {
		data = IPPoolData{}
	}

	for _, item := range data.IPs {
		if item.IP == ip {
			return nil, fmt.Errorf("IP address '%s' already exists in pool", ip)
		}
	}

	if iface == "" {
		iface = "eth0"
		if interfaces, err := net.Interfaces(); err == nil {
			for _, i := range interfaces {
				if i.Flags&net.FlagLoopback == 0 && i.Flags&net.FlagUp != 0 {
					iface = i.Name
					break
				}
			}
		}
	}

	cidr := defaultCIDR
	if strings.HasPrefix(netmask, "/") {
		var parsed int
		if _, err := fmt.Sscanf(netmask, "/%d", &parsed); err == nil && parsed > 0 && parsed <= 128 {
			cidr = parsed
		}
	}

	if role == "" {
		role = "shared"
	}

	// Bind IP alias to network interface
	cidrStr := fmt.Sprintf("%s/%d", ip, cidr)
	_ = exec.Command("ip", "addr", "add", cidrStr, "dev", iface).Run()

	newItem := IPAddressItem{
		ID:          fmt.Sprintf("ip_%d", time.Now().UnixNano()%1000000),
		IP:          ip,
		Version:     version,
		Netmask:     netmask,
		CIDR:        cidr,
		Gateway:     gateway,
		Interface:   iface,
		Role:        role,
		AssignedTo:  assignedTo,
		IsBound:     true,
		IsPrimary:   false,
		AccountsNum: 0,
		DomainsNum:  0,
		CreatedAt:   time.Now().Format(time.RFC3339),
	}

	data.IPs = append(data.IPs, newItem)
	if err := s.writePoolUnsafe(data); err != nil {
		return nil, err
	}

	return &newItem, nil
}

// DeleteIP unbinds and deletes an IP from pool
func (s *IPService) DeleteIP(ip string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	ip = strings.TrimSpace(ip)
	data, err := s.readPoolUnsafe()
	if err != nil {
		return err
	}

	var found *IPAddressItem
	var updated []IPAddressItem
	for _, item := range data.IPs {
		if item.IP == ip {
			found = &item
		} else {
			updated = append(updated, item)
		}
	}

	if found == nil {
		return fmt.Errorf("IP address '%s' not found", ip)
	}

	if found.IsPrimary {
		return fmt.Errorf("cannot delete Primary Server IP '%s'", ip)
	}

	if found.AccountsNum > 0 {
		return fmt.Errorf("cannot delete IP '%s': currently assigned to %d active accounts", ip, found.AccountsNum)
	}

	// Unbind from OS interface
	cidrStr := fmt.Sprintf("%s/%d", found.IP, found.CIDR)
	_ = exec.Command("ip", "addr", "del", cidrStr, "dev", found.Interface).Run()

	data.IPs = updated
	return s.writePoolUnsafe(data)
}

// SetRole changes role of an IP (main, shared, dedicated)
func (s *IPService) SetRole(ip, role, assignedTo string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := s.readPoolUnsafe()
	if err != nil {
		return err
	}

	found := false
	for i := range data.IPs {
		if data.IPs[i].IP == ip {
			if role == "main" {
				for j := range data.IPs {
					data.IPs[j].IsPrimary = false
					if data.IPs[j].Role == "main" {
						data.IPs[j].Role = "shared"
					}
				}
				data.IPs[i].IsPrimary = true
				data.IPs[i].Role = "main"
			} else {
				data.IPs[i].Role = role
				data.IPs[i].AssignedTo = assignedTo
			}
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("IP '%s' not found", ip)
	}

	return s.writePoolUnsafe(data)
}
