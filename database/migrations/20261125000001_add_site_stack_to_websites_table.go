package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"goravel/app/facades"
)

// M20261125000001AddSiteStackToWebsitesTable adds the per-domain web stack request
// (domain.SiteStack). Empty values mean "follow the server mode default"; rows written
// before this migration are read through domain.ParseBackend(server_engine).
type M20261125000001AddSiteStackToWebsitesTable struct{}

func (r *M20261125000001AddSiteStackToWebsitesTable) Signature() string {
	return "20261125000001_add_site_stack_to_websites_table"
}

func (r *M20261125000001AddSiteStackToWebsitesTable) Up() error {
	if !facades.Schema().HasTable("websites") || facades.Schema().HasColumn("websites", "backend") {
		return nil
	}
	return facades.Schema().Table("websites", func(table schema.Blueprint) {
		table.String("backend").Default("")
		table.String("php_handler").Default("")
		table.String("varnish").Default("")
	})
}

func (r *M20261125000001AddSiteStackToWebsitesTable) Down() error {
	if !facades.Schema().HasTable("websites") {
		return nil
	}
	return facades.Schema().Table("websites", func(table schema.Blueprint) {
		table.DropColumn("backend", "php_handler", "varnish")
	})
}
