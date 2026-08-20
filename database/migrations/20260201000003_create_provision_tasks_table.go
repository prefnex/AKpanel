package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260201000003CreateProvisionTasksTable struct{}

func (r *M20260201000003CreateProvisionTasksTable) Signature() string {
	return "20260201000003_create_provision_tasks_table"
}

func (r *M20260201000003CreateProvisionTasksTable) Up() error {
	if facades.Schema().HasTable("provision_tasks") {
		return nil
	}
	return facades.Schema().Create("provision_tasks", func(table schema.Blueprint) {
		table.String("id")
		table.String("kind")
		table.String("subject").Nullable()
		table.String("status").Default("pending")
		table.Integer("progress").Default(0)
		table.String("current_step").Nullable()
		table.Text("steps_json").Nullable()
		table.Text("logs_json").Nullable()
		table.Text("error").Nullable()
		table.Timestamps()
		table.Primary("id")
	})
}

func (r *M20260201000003CreateProvisionTasksTable) Down() error {
	return facades.Schema().DropIfExists("provision_tasks")
}
