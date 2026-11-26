package domain

import (
	"sort"
	"strings"
)

// SiteService is a panel service published on a subdomain of a customer domain
// (CWP-style: webmail.example.com, cpanel.example.com …). Each one becomes its own vhost,
// shares the domain's certificate and is listed as a SAN when the certificate is issued.
type SiteService string

const (
	ServiceWebmail SiteService = "webmail" // Roundcube
	ServiceMail    SiteService = "mail"    // Roundcube too; also the MX / IMAP / SMTP host name
	ServiceCpanel  SiteService = "cpanel"  // the account's client panel
	ServiceFTP     SiteService = "ftp"     // small info page; the name is what FTP clients connect to
)

// AllSiteServices in display order.
var AllSiteServices = []SiteService{ServiceWebmail, ServiceMail, ServiceCpanel, ServiceFTP}

// SiteServicesNone is stored when the owner turned every service off (empty means "default").
const SiteServicesNone = "none"

// SiteServiceInfo describes a service for the UI.
type SiteServiceInfo struct {
	ID          SiteService `json:"id"`
	Title       string      `json:"title"`
	Description string      `json:"description"`
}

func (s SiteService) Info() SiteServiceInfo {
	switch s {
	case ServiceWebmail:
		return SiteServiceInfo{s, "Webmail", "Roundcube on webmail.<domain>"}
	case ServiceMail:
		return SiteServiceInfo{s, "Mail", "Roundcube on mail.<domain>, and the name mail clients use"}
	case ServiceCpanel:
		return SiteServiceInfo{s, "Client panel", "The account's control panel on cpanel.<domain>"}
	case ServiceFTP:
		return SiteServiceInfo{s, "FTP", "ftp.<domain> for FTP clients, with an info page over HTTP"}
	}
	return SiteServiceInfo{ID: s, Title: string(s)}
}

// Host is the service's hostname for domain.
func (s SiteService) Host(domainName string) string { return string(s) + "." + domainName }

// DefaultSiteServices: account domains get every service (as CWP does); sites owned by root
// have no client panel account behind them, so they get mail and webmail only. Subdomains of
// another site get none (blog.example.com does not need webmail.blog.example.com).
func DefaultSiteServices(owner string, isSubdomainOfSite bool) []SiteService {
	if isSubdomainOfSite {
		return nil
	}
	if owner == "" || owner == "root" {
		return []SiteService{ServiceWebmail, ServiceMail}
	}
	return append([]SiteService(nil), AllSiteServices...)
}

// ParseSiteServices reads the stored column: "" → defaults, "none" → no services,
// otherwise a comma list (unknown names dropped, order normalised).
func ParseSiteServices(stored string, defaults []SiteService) []SiteService {
	stored = strings.TrimSpace(stored)
	switch stored {
	case "":
		return defaults
	case SiteServicesNone:
		return nil
	}
	return NormalizeSiteServices(strings.Split(stored, ","))
}

// NormalizeSiteServices keeps known services, once each, in AllSiteServices order.
func NormalizeSiteServices(names []string) []SiteService {
	want := map[SiteService]bool{}
	for _, n := range names {
		want[SiteService(strings.ToLower(strings.TrimSpace(n)))] = true
	}
	var out []SiteService
	for _, s := range AllSiteServices {
		if want[s] {
			out = append(out, s)
		}
	}
	return out
}

// FormatSiteServices is the stored form of an explicit choice.
func FormatSiteServices(list []SiteService) string {
	if len(list) == 0 {
		return SiteServicesNone
	}
	names := make([]string, 0, len(list))
	for _, s := range NormalizeSiteServices(toStrings(list)) {
		names = append(names, string(s))
	}
	return strings.Join(names, ",")
}

// ServiceHostPrefixes are the first labels every per-domain service vhost may use, including
// legacy ones (imap./pop.) that older releases created and that are cleaned up on rebuild.
var ServiceHostPrefixes = []string{"webmail", "mail", "cpanel", "ftp", "imap", "pop"}

func toStrings(list []SiteService) []string {
	out := make([]string, len(list))
	for i, s := range list {
		out[i] = string(s)
	}
	sort.Strings(out)
	return out
}
