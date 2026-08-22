package migrations

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/app/facades"
)

type M20260222000001CreateMailDeliveriesTable struct{}

func (r *M20260222000001CreateMailDeliveriesTable) Signature() string {
	return "20260222000001_create_mail_deliveries_table"
}

func (r *M20260222000001CreateMailDeliveriesTable) Up() error {
	if facades.Schema().HasTable("mail_deliveries") {
		return nil
	}
	return facades.Schema().Create("mail_deliveries", func(table schema.Blueprint) {
		table.ID()
		table.String("queue_id", 32).Nullable()
		table.String("message_id", 255).Nullable()
		table.String("sender", 255).Nullable()
		table.String("recipient", 255).Nullable()
		table.String("subject", 512).Nullable()
		table.String("status", 32).Nullable()
		table.String("dsn", 64).Nullable()
		table.String("relay", 255).Nullable()
		table.String("delay", 64).Nullable()
		table.Text("reason").Nullable()
		table.Text("log_line").Nullable()
		table.Timestamps()
	})
}

func (r *M20260222000001CreateMailDeliveriesTable) Down() error {
	return facades.Schema().DropIfExists("mail_deliveries")
}
