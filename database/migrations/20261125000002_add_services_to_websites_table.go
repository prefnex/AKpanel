package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"goravel/app/facades"
)

// M20261125000002AddServicesToWebsitesTable adds the per-domain service subdomains
// (domain.SiteService: webmail, mail, cpanel, ftp). Empty means "the default for this
// domain"; "none" means the owner turned them all off.
type M20261125000002AddServicesToWebsitesTable struct{}

func (r *M20261125000002AddServicesToWebsitesTable) Signature() string {
	return "20261125000002_add_services_to_websites_table"
}

func (r *M20261125000002AddServicesToWebsitesTable) Up() error {
	if !facades.Schema().HasTable("websites") || facades.Schema().HasColumn("websites", "services") {
		return nil
	}
	return facades.Schema().Table("websites", func(table schema.Blueprint) {
		table.String("services").Default("")
	})
}

func (r *M20261125000002AddServicesToWebsitesTable) Down() error {
	if !facades.Schema().HasTable("websites") {
		return nil
	}
	return facades.Schema().Table("websites", func(table schema.Blueprint) {
		table.DropColumn("services")
	})
}
