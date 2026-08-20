package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"
	"goravel/app/facades"
)

type M20260201000002CreateUsersTable struct{}

// Signature The unique signature for the migration.
func (r *M20260201000002CreateUsersTable) Signature() string {
	return "20260201000002_create_users_table"
}

// Up Run the migrations.
func (r *M20260201000002CreateUsersTable) Up() error {
	if !facades.Schema().HasTable("users") {
		if err := facades.Schema().Create("users", func(table schema.Blueprint) {
			table.ID()
			table.String("username")
			table.String("password_hash")
			table.String("email").Nullable()
			table.String("main_domain").Nullable()
			table.String("package_id").Nullable()
			table.String("package_name").Nullable()
			table.String("home_dir").Nullable()
			table.String("status").Default("active")
			table.String("suspended_reason").Nullable()
			table.Boolean("is_reseller").Default(false)
			table.Boolean("shell_access").Default(false)
			table.String("language").Default("en")
			table.String("ip_address").Nullable()
			table.Integer("disk_quota_mb").Default(0)
			table.Integer("bandwidth_limit_mb").Default(0)
			table.Integer("inodes_limit").Default(0)
			table.Integer("ram_limit_mb").Default(0)
			table.Integer("max_processes").Default(40)
			table.Timestamps()
			table.Unique("username")
		}); err != nil {
			return err
		}
	}
	return nil
}

// Down Reverse the migrations.
func (r *M20260201000002CreateUsersTable) Down() error {
	return facades.Schema().DropIfExists("users")
}
