package provisioning

import "context"

// UserStep is an atomic unit in the user provisioning pipeline.
type UserStep interface {
	Name() string
	Execute(ctx context.Context, plan *UserProvisionPlan) error
	Rollback(ctx context.Context, plan *UserProvisionPlan) error
}
