package provisioning

import (
	"context"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/paths"
	"goravel/app/services"
)

// Subdomains (CWP's "Add SubDomain"): a site named <label>.<parent> that belongs to the
// parent's owner, inherits its web stack and PHP version, gets an A record in the parent's
// DNS zone, and can request its own certificate right away.

// SubdomainRequest is what the admin (or later the client panel) submits.
type SubdomainRequest struct {
	Name    string `json:"name"`    // label(s) in front of the parent, e.g. "blog" or "api.v2"
	Parent  string `json:"parent"`  // an existing site
	Path    string `json:"path"`    // document root: relative to the owner's home (accounts) or /var/www/sites (root); "" = default
	AutoSSL bool   `json:"autossl"` // start a certificate request after creation
}

// SubdomainResult reports the created site and the SSL task (if any).
type SubdomainResult struct {
	Website   *models.Website `json:"website"`
	DNS       string          `json:"dns"`
	SSLTaskID string          `json:"ssl_task_id,omitempty"`
}

var subLabels = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$`)

func lookupSite(domain string) *models.Website {
	var r models.Website
	if facades.Orm() == nil {
		return nil
	}
	if err := facades.Orm().Query().Where("domain = ?", domain).First(&r); err != nil || r.ID == 0 {
		return nil
	}
	return &r
}

// subdomainBase is the directory a custom document root must stay inside.
func subdomainBase(owner string) string {
	if owner == "" || owner == "root" || owner == "admin" {
		return paths.SitesRoot
	}
	return paths.UserHome(owner)
}

// resolveSubdomainRoot turns the requested path into an absolute document root inside base.
func resolveSubdomainRoot(owner, fqdn, rel string) (string, error) {
	rel = strings.TrimSpace(rel)
	if rel == "" {
		return paths.ResolveWebsiteRoot(owner, fqdn), nil
	}
	base := subdomainBase(owner)
	for _, seg := range strings.Split(rel, "/") {
		if seg == ".." {
			return "", fmt.Errorf("the path cannot contain ..")
		}
	}
	clean := filepath.Clean("/" + rel) // no way above "/"
	root := filepath.Join(base, clean)
	if root == base || !strings.HasPrefix(root, base+"/") {
		return "", fmt.Errorf("the path must be a folder inside %s", base)
	}
	// An existing symlink on the way must not lead outside base.
	for p := root; p != base && p != "/"; p = filepath.Dir(p) {
		if real, err := filepath.EvalSymlinks(p); err == nil {
			if real != base && !strings.HasPrefix(real, base+"/") {
				return "", fmt.Errorf("the path leads outside %s", base)
			}
			break
		}
	}
	return root, nil
}

// CreateSubdomain provisions name.parent for the parent's owner.
func (o *ProvisioningOrchestrator) CreateSubdomain(ctx context.Context, req SubdomainRequest) (*SubdomainResult, error) {
	name := strings.ToLower(strings.Trim(strings.TrimSpace(req.Name), "."))
	parentName := strings.ToLower(strings.TrimSpace(req.Parent))
	if name == "" || !subLabels.MatchString(name) {
		return nil, fmt.Errorf("subdomain name must be letters, digits and hyphens (e.g. blog or api.v2)")
	}
	if name == "www" {
		return nil, fmt.Errorf("www is already part of every site")
	}
	parent := lookupSite(parentName)
	if parent == nil {
		return nil, fmt.Errorf("parent domain %s is not a site on this server", parentName)
	}
	fqdn := name + "." + parentName
	if len(fqdn) > 253 {
		return nil, fmt.Errorf("%s is too long", fqdn)
	}
	if lookupSite(fqdn) != nil {
		return nil, fmt.Errorf("%s already exists", fqdn)
	}
	owner := parent.OwnerUsername
	if owner == "" {
		owner = "root"
	}
	root, err := resolveSubdomainRoot(owner, fqdn, req.Path)
	if err != nil {
		return nil, err
	}

	rr := parent.StackRequest()
	siteType := parent.SiteType
	if siteType == "" || siteType == "proxy" {
		siteType = "php"
	}
	plan := &ProvisionPlan{
		Domain:        fqdn,
		OwnerUsername: owner,
		PackageID:     parent.PackageID,
		RootPath:      root,
		Backend:       rr.Backend,
		PHPHandler:    string(rr.PHPHandler),
		Varnish:       rr.Varnish,
		PHPVersion:    parent.PHPVersion,
		TemplateID:    "custom",
		SiteType:      siteType,
		CreateDNS:     false, // a record in the parent's zone instead of a zone of its own
		IsClientSite:  owner != "root",
	}
	site, err := o.ProvisionWebsite(ctx, plan)
	if err != nil {
		return nil, err
	}
	res := &SubdomainResult{Website: site, DNS: services.AddSubdomainRecord(parentName, name)}
	if req.AutoSSL {
		if id, err := services.NewSecurityService().StartSSLTask("issue", fqdn, ""); err == nil {
			res.SSLTaskID = id
		}
	}
	return res, nil
}

// DeleteSubdomain removes the site and its record in the parent's zone. Files stay unless
// the site is removed through the regular website delete.
func (o *ProvisioningOrchestrator) DeleteSubdomain(ctx context.Context, fqdn string) error {
	fqdn = strings.ToLower(strings.TrimSpace(fqdn))
	sub := services.FindSubdomain(fqdn)
	if sub == nil {
		return fmt.Errorf("%s is not a subdomain on this server", fqdn)
	}
	if err := o.DeprovisionWebsite(ctx, fqdn); err != nil {
		return err
	}
	services.RemoveSubdomainRecord(sub.Parent, strings.TrimSuffix(fqdn, "."+sub.Parent))
	return nil
}
