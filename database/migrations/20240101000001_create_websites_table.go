package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"goravel/app/facades"
)

type M20240101000001CreateWebsitesTable struct{}

// Signature The unique signature for the migration.
func (r *M20240101000001CreateWebsitesTable) Signature() string {
	return "20240101000001_create_websites_table"
}

// Up Run the migrations.
func (r *M20240101000001CreateWebsitesTable) Up() error {
	if !facades.Schema().HasTable("websites") {
		if err := facades.Schema().Create("websites", func(table schema.Blueprint) {
			table.ID()
			table.String("domain")
			table.String("server_engine").Default("nginx")
			table.String("template_id").Default("laravel")
			table.String("php_version").Default("8.2")
			table.String("site_type").Default("php")
			table.Integer("proxy_port").Default(0)
			table.String("root_path")
			table.Boolean("ssl_active").Default(false)
			table.Timestamps()
			table.Unique("domain")
		}); err != nil {
			return err
		}
	}
	return nil
}

// Down Reverse the migrations.
func (r *M20240101000001CreateWebsitesTable) Down() error {
	return facades.Schema().DropIfExists("websites")
}
