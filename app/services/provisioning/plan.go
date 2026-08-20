package provisioning

import (
	"goravel/app/domain"
	"goravel/app/models"
)

// ProvisionPlan holds the declarative parameters for creating a new website.
type ProvisionPlan struct {
	Domain        string           `json:"domain"`
	OwnerUsername string           `json:"owner_username"`
	PackageID     string           `json:"package_id"`
	RootPath      string           `json:"root_path"`
	Engine        domain.WebEngine `json:"engine"`
	PHPVersion    string           `json:"php_version"`
	TemplateID    string           `json:"template_id"`
	SiteType      string           `json:"site_type"`
	ProxyPort     int              `json:"proxy_port"`
	CreateDNS     bool             `json:"create_dns"`
	CreateSSL     bool             `json:"create_ssl"`
	ServerIP      string           `json:"server_ip"`
	IsClientSite  bool             `json:"is_client_site"`

	// Execution Results
	ResultWebsite *models.Website `json:"result_website,omitempty"`
}
