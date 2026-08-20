package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"goravel/app/facades"
)

type M20260201000001AddOwnerToWebsitesTable struct{}

// Signature The unique signature for the migration.
func (r *M20260201000001AddOwnerToWebsitesTable) Signature() string {
	return "20260201000001_add_owner_to_websites_table"
}

// Up Run the migrations.
func (r *M20260201000001AddOwnerToWebsitesTable) Up() error {
	if facades.Schema().HasTable("websites") {
		if !facades.Schema().HasColumn("websites", "owner_username") {
			if err := facades.Schema().Table("websites", func(table schema.Blueprint) {
				table.String("owner_username").Default("root")
				table.String("package_id").Nullable()
				table.String("status").Default("active")
			}); err != nil {
				return err
			}
		}
	}
	return nil
}

// Down Reverse the migrations.
func (r *M20260201000001AddOwnerToWebsitesTable) Down() error {
	if facades.Schema().HasTable("websites") {
		return facades.Schema().Table("websites", func(table schema.Blueprint) {
			table.DropColumn("owner_username", "package_id", "status")
		})
	}
	return nil
}
