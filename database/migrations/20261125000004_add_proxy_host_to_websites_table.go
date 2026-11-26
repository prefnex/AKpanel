package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"goravel/app/facades"
)

// M20261125000004AddProxyHostToWebsitesTable adds the upstream host of proxy sites
// (empty means 127.0.0.1), so a domain can proxy to any IP:port.
type M20261125000004AddProxyHostToWebsitesTable struct{}

func (r *M20261125000004AddProxyHostToWebsitesTable) Signature() string {
	return "20261125000004_add_proxy_host_to_websites_table"
}

func (r *M20261125000004AddProxyHostToWebsitesTable) Up() error {
	if !facades.Schema().HasTable("websites") || facades.Schema().HasColumn("websites", "proxy_host") {
		return nil
	}
	return facades.Schema().Table("websites", func(table schema.Blueprint) {
		table.String("proxy_host").Default("")
	})
}

func (r *M20261125000004AddProxyHostToWebsitesTable) Down() error {
	if !facades.Schema().HasTable("websites") {
		return nil
	}
	return facades.Schema().Table("websites", func(table schema.Blueprint) {
		table.DropColumn("proxy_host")
	})
}
