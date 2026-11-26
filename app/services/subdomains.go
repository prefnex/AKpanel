package services

import (
	"sort"
	"strings"

	"goravel/app/models"
)

// Subdomain is a site whose name ends in another site's name (blog.example.com under
// example.com). It is an ordinary website row; the parent is derived, so subdomains created
// before this view existed show up too.
type Subdomain struct {
	Domain    string `json:"domain"`
	Name      string `json:"name"` // the labels in front of the parent
	Parent    string `json:"parent"`
	Owner     string `json:"owner"`
	RootPath  string `json:"root_path"`
	SSLActive bool   `json:"ssl_active"`
	Status    string `json:"status"`
	CreatedAt string `json:"created_at"`
}

// parentSite is the closest site the domain is a subdomain of ("" when none).
func parentSite(domainName string, sites map[string]bool) string {
	labels := strings.Split(domainName, ".")
	for i := 1; i < len(labels)-1; i++ {
		if cand := strings.Join(labels[i:], "."); sites[cand] {
			return cand
		}
	}
	return ""
}

func subdomainFromRow(r *models.Website, parent string) Subdomain {
	owner := r.OwnerUsername
	if owner == "" {
		owner = "root"
	}
	s := Subdomain{
		Domain: r.Domain, Name: strings.TrimSuffix(r.Domain, "."+parent), Parent: parent, Owner: owner,
		RootPath: r.RootPath, SSLActive: r.SSLActive, Status: r.Status,
	}
	if r.CreatedAt != nil {
		s.CreatedAt = r.CreatedAt.ToDateTimeString()
	}
	return s
}

func allSiteRows() []models.Website {
	var rows []models.Website
	if panelOrm() == nil {
		return nil
	}
	_ = panelOrm().Query().Order("domain").Find(&rows)
	return rows
}

// ListSubdomains returns every subdomain site, optionally of one owner ("" = all).
func ListSubdomains(owner string) []Subdomain {
	rows := allSiteRows()
	names := map[string]bool{}
	for _, r := range rows {
		names[r.Domain] = true
	}
	out := []Subdomain{}
	for i := range rows {
		parent := parentSite(rows[i].Domain, names)
		if parent == "" {
			continue
		}
		s := subdomainFromRow(&rows[i], parent)
		if owner != "" && s.Owner != owner {
			continue
		}
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Parent != out[j].Parent {
			return out[i].Parent < out[j].Parent
		}
		return out[i].Domain < out[j].Domain
	})
	return out
}

// FindSubdomain returns one subdomain, or nil when the domain is not one.
func FindSubdomain(fqdn string) *Subdomain {
	for _, s := range ListSubdomains("") {
		if s.Domain == fqdn {
			return &s
		}
	}
	return nil
}

// AddSubdomainRecord points name.<parent> at the server in the parent's zone, when the
// parent has a zone here. It reports what it did for the UI.
func AddSubdomainRecord(parent, name string) string {
	dns := NewDNSService()
	zone, err := dns.GetZone(parent)
	if err != nil || zone == nil {
		return "no DNS zone for " + parent + " on this server: add an A record at your DNS provider"
	}
	for _, r := range zone.Records {
		if strings.EqualFold(r.Name, name) && (r.Type == "A" || r.Type == "CNAME") {
			return "DNS record " + name + " already exists in " + parent
		}
	}
	ip := zone.ServerIP
	if ip == "" {
		ip = dns.GetSystemIP()
	}
	if err := dns.AddRecord(parent, DNSRecord{Name: name, Type: "A", Value: ip, TTL: 14400, Comment: "subdomain"}); err != nil {
		return "DNS record not added: " + err.Error()
	}
	return "A record " + name + "." + parent + " → " + ip + " added"
}

// RemoveSubdomainRecord deletes the A record AddSubdomainRecord created.
func RemoveSubdomainRecord(parent, name string) {
	dns := NewDNSService()
	zone, err := dns.GetZone(parent)
	if err != nil || zone == nil {
		return
	}
	for i := len(zone.Records) - 1; i >= 0; i-- {
		r := zone.Records[i]
		if strings.EqualFold(r.Name, name) && r.Type == "A" && r.Comment == "subdomain" {
			_ = dns.DeleteRecord(parent, i)
		}
	}
}
