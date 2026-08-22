package bootstrap

import (
	"github.com/goravel/framework/contracts/database/schema"

	"goravel/database/migrations"
)

func Migrations() []schema.Migration {
	return []schema.Migration{
		&migrations.M20210101000001CreateJobsTable{},
		&migrations.M20240101000001CreateWebsitesTable{},
		&migrations.M20260201000001AddOwnerToWebsitesTable{},
		&migrations.M20260201000002CreateUsersTable{},
		&migrations.M20260201000003CreateProvisionTasksTable{},
		&migrations.M20260222000001CreateMailDeliveriesTable{},
	}
}
