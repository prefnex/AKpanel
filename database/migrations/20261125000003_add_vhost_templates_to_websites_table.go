package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"goravel/app/facades"
)

// M20261125000003AddVhostTemplatesToWebsitesTable adds the per-domain vhost library
// templates (templates.VhostTemplate names). Empty means "the Main Conf default"; "none"
// means no templates.
type M20261125000003AddVhostTemplatesToWebsitesTable struct{}

func (r *M20261125000003AddVhostTemplatesToWebsitesTable) Signature() string {
	return "20261125000003_add_vhost_templates_to_websites_table"
}

func (r *M20261125000003AddVhostTemplatesToWebsitesTable) Up() error {
	if !facades.Schema().HasTable("websites") || facades.Schema().HasColumn("websites", "vhost_templates") {
		return nil
	}
	return facades.Schema().Table("websites", func(table schema.Blueprint) {
		table.String("vhost_templates").Default("")
	})
}

func (r *M20261125000003AddVhostTemplatesToWebsitesTable) Down() error {
	if !facades.Schema().HasTable("websites") {
		return nil
	}
	return facades.Schema().Table("websites", func(table schema.Blueprint) {
		table.DropColumn("vhost_templates")
	})
}
