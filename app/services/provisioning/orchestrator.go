package provisioning

import (
	"context"
	"fmt"
	"sync"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services"
)

// ProvisioningOrchestrator coordinates website lifecycle through an atomic pipeline.
type ProvisioningOrchestrator struct {
	mu           sync.Mutex
	nginxService *services.NginxService
	dnsService   *services.DNSService
}

var (
	orchestratorInstance *ProvisioningOrchestrator
	orchestratorOnce     sync.Once
)

// GetOrchestrator returns the singleton ProvisioningOrchestrator
func GetOrchestrator() *ProvisioningOrchestrator {
	orchestratorOnce.Do(func() {
		orchestratorInstance = &ProvisioningOrchestrator{
			nginxService: services.NewNginxService(),
			dnsService:   services.NewDNSService(),
		}
	})
	return orchestratorInstance
}

// ProvisionWebsite executes the complete provisioning pipeline with automatic rollback on error.
func (o *ProvisioningOrchestrator) ProvisionWebsite(ctx context.Context, plan *ProvisionPlan) (*models.Website, error) {
	o.mu.Lock()
	defer o.mu.Unlock()

	steps := []Step{
		&ValidatePlanStep{},
		&CreateDirectoriesStep{},
		NewCreateWebServersStep(),
		NewCreateDNSStep(),
		&SaveDatabaseStep{},
		NewIssueSSLStep(),
	}

	executedSteps := make([]Step, 0, len(steps))

	for _, step := range steps {
		if err := step.Execute(ctx, plan); err != nil {
			if facades.Log() != nil {
				facades.Log().Error(fmt.Sprintf("[orchestrator] Step '%s' failed for domain '%s': %v. Rolling back...", step.Name(), plan.Domain, err))
			}
			// Rollback executed steps in reverse order
			for i := len(executedSteps) - 1; i >= 0; i-- {
				rbStep := executedSteps[i]
				if rbErr := rbStep.Rollback(ctx, plan); rbErr != nil {
					if facades.Log() != nil {
						facades.Log().Error(fmt.Sprintf("[orchestrator] Rollback of step '%s' failed: %v", rbStep.Name(), rbErr))
					}
				}
			}
			return nil, fmt.Errorf("provisioning failed at step '%s': %w", step.Name(), err)
		}
		executedSteps = append(executedSteps, step)
	}

	if facades.Log() != nil {
		facades.Log().Info(fmt.Sprintf("[orchestrator] Website '%s' successfully provisioned (owner: %s, engine: %s)", plan.Domain, plan.OwnerUsername, plan.Engine))
	}

	return plan.ResultWebsite, nil
}

// DeprovisionWebsite completely removes a website: web server configs, DNS zone, and DB record.
func (o *ProvisioningOrchestrator) DeprovisionWebsite(ctx context.Context, domain string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	if o.nginxService != nil {
		_ = o.nginxService.DeleteWebsite(domain)
	}

	if o.dnsService != nil {
		_ = o.dnsService.DeleteZone(domain)
	}

	if facades.Orm() != nil {
		_, _ = facades.Orm().Query().Where("domain = ?", domain).Delete(&models.Website{})
	}

	if facades.Log() != nil {
		facades.Log().Info(fmt.Sprintf("[orchestrator] Website '%s' successfully deprovisioned", domain))
	}

	return nil
}
