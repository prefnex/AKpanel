package provisioning

import "context"

// Step defines an individual atomic unit of work in the provisioning pipeline.
type Step interface {
	Name() string
	Execute(ctx context.Context, plan *ProvisionPlan) error
	Rollback(ctx context.Context, plan *ProvisionPlan) error
}
