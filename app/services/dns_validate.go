package services

import (
	"fmt"
	"net"
	"regexp"
	"strings"
	"unicode/utf8"
)

var dnsNameRe = regexp.MustCompile(`(?i)^(\*|[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?)(\.[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?)*\.?$`)

func allowedDNSTypes() map[string]bool {
	return map[string]bool{
		"A": true, "AAAA": true, "CNAME": true, "MX": true, "TXT": true,
		"NS": true, "SRV": true, "CAA": true, "PTR": true, "SOA": true,
	}
}

// ValidateDNSRecord rejects values that would break BIND or the zone semantics.
func ValidateDNSRecord(zoneDomain string, rec DNSRecord) error {
	rec.Type = strings.ToUpper(strings.TrimSpace(rec.Type))
	rec.Name = strings.TrimSpace(rec.Name)
	rec.Value = strings.TrimSpace(rec.Value)
	if rec.Name == "" {
		rec.Name = "@"
	}
	if !allowedDNSTypes()[rec.Type] {
		return fmt.Errorf("record type %s is not allowed", rec.Type)
	}
	if rec.TTL != 0 && (rec.TTL < 60 || rec.TTL > 86400*30) {
		return fmt.Errorf("TTL must be between 60 and 2592000 seconds")
	}
	if strings.ContainsAny(rec.Value, "\n\r;") || strings.Contains(rec.Value, "(") || strings.Contains(rec.Value, ")") {
		return fmt.Errorf("record value contains forbidden characters")
	}
	if rec.Name != "@" && rec.Name != "*" && !dnsNameRe.MatchString(strings.TrimSuffix(rec.Name, ".")) {
		return fmt.Errorf("invalid DNS host name %q", rec.Name)
	}
	if utf8.RuneCountInString(rec.Value) > 4096 {
		return fmt.Errorf("record value is too long")
	}

	switch rec.Type {
	case "A":
		ip := net.ParseIP(rec.Value)
		if ip == nil || ip.To4() == nil {
			return fmt.Errorf("A record requires a valid IPv4 address")
		}
	case "AAAA":
		ip := net.ParseIP(rec.Value)
		if ip == nil || ip.To4() != nil {
			return fmt.Errorf("AAAA record requires a valid IPv6 address")
		}
	case "CNAME", "NS", "PTR", "MX":
		host := rec.Value
		if rec.Type == "MX" {
			host = rec.Value
			if rec.Priority < 0 || rec.Priority > 65535 {
				return fmt.Errorf("MX priority must be 0-65535")
			}
		}
		host = strings.TrimSuffix(host, ".")
		if host == "" || strings.Contains(host, " ") || !dnsNameRe.MatchString(host) {
			return fmt.Errorf("%s record requires a valid hostname", rec.Type)
		}
		if rec.Type == "CNAME" && (rec.Name == "@" || strings.EqualFold(rec.Name, zoneDomain)) {
			return fmt.Errorf("CNAME is not allowed on the zone apex")
		}
	case "TXT":
		if rec.Value == "" {
			return fmt.Errorf("TXT record cannot be empty")
		}
	case "SOA":
		return fmt.Errorf("SOA records are managed by AKpanel and cannot be added manually")
	}
	return nil
}

func zoneHasMinNS(records []DNSRecord, skipIndex int) bool {
	n := 0
	for i, r := range records {
		if i == skipIndex {
			continue
		}
		if strings.EqualFold(r.Type, "NS") {
			n++
		}
	}
	return n >= 1
}
