package provisioning

import (
	"context"
	"fmt"
	"sync"

	"goravel/app/facades"
	"goravel/app/models"
	"goravel/app/services"
	"goravel/app/services/tasks"
)

// UserProvisioningOrchestrator runs the async user creation pipeline.
type UserProvisioningOrchestrator struct {
	mu sync.Mutex
}

var (
	userOrchestrator     *UserProvisioningOrchestrator
	userOrchestratorOnce sync.Once
)

func GetUserOrchestrator() *UserProvisioningOrchestrator {
	userOrchestratorOnce.Do(func() {
		userOrchestrator = &UserProvisioningOrchestrator{}
	})
	return userOrchestrator
}

func (o *UserProvisioningOrchestrator) buildSteps() []UserStep {
	return []UserStep{
		&ValidateUserPlanStep{},
		&DetectEnginesStep{},
		&CreateLinuxUserStep{},
		&CreateUserDirectoriesStep{},
		&CreatePHPFMPPoolStep{},
		&CreateDBUsersStep{},
		&CreateFTPAccountStep{},
		&CreateMainVhostStep{},
		&CreateUserDNSZoneStep{},
		&CreateServiceSubdomainsStep{},
		&IssueWildcardSSLStep{},
		&RegenerateVhostsStep{},
		&CreateMailboxStep{},
		&PersistUserRecordStep{},
		&VerifyProvisionStep{},
	}
}

// StartAsyncProvision creates a task and runs provisioning in a background goroutine.
func (o *UserProvisioningOrchestrator) StartAsyncProvision(plan *UserProvisionPlan) (string, error) {
	title := fmt.Sprintf("Provision user %s", plan.Username)
	task, err := tasks.GetRegistry().Create("user_provision", plan.Username, title)
	if err != nil {
		return "", err
	}
	plan.TaskID = task.ID

	go func() {
		if err := o.ProvisionUser(context.Background(), plan); err != nil {
			_ = tasks.GetRegistry().Fail(plan.TaskID, err.Error(), fmt.Sprintf("Failed: %v", err))
			if facades.Log() != nil {
				facades.Log().Error(fmt.Sprintf("[user-orchestrator] %v", err))
			}
			return
		}
		_ = tasks.GetRegistry().Complete(plan.TaskID, fmt.Sprintf("User %s provisioned successfully", plan.Username))
	}()

	return task.ID, nil
}

// ProvisionUser executes all steps synchronously (used by async worker and optional sync path).
func (o *UserProvisioningOrchestrator) ProvisionUser(ctx context.Context, plan *UserProvisionPlan) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	steps := o.buildSteps()
	executed := make([]UserStep, 0, len(steps))
	total := len(steps)

	for i, step := range steps {
		pct := (i * 100) / total
		_ = tasks.GetRegistry().UpdateProgress(plan.TaskID, step.Name(), pct, fmt.Sprintf("Running step: %s", step.Name()))

		if err := step.Execute(ctx, plan); err != nil {
			// The failing step may have left partial artifacts (e.g. a vhost that failed the
			// syntax test), so it is rolled back too; rollbacks are idempotent.
			_ = step.Rollback(ctx, plan)
			for j := len(executed) - 1; j >= 0; j-- {
				_ = executed[j].Rollback(ctx, plan)
			}
			return fmt.Errorf("step '%s' failed: %w", step.Name(), err)
		}
		executed = append(executed, step)
	}

	return nil
}

var serviceSubdomainPrefixes = []string{"webmail.", "cpanel.", "ftp.", "imap.", "pop."}

// DeprovisionUser tears down everything a hosting account owns: websites and their
// service subdomains, DNS zones, mailboxes, PHP-FPM pools, then the Linux account, home,
// databases, FTP and cron (services.DeleteUser + PurgeAccount).
func (o *UserProvisioningOrchestrator) DeprovisionUser(ctx context.Context, username string) error {
	o.mu.Lock()
	defer o.mu.Unlock()

	if !services.IsValidAccountUsername(username) {
		return fmt.Errorf("invalid account name")
	}
	uas := services.NewUserAccountService()
	user, err := uas.GetUser(username)
	if err != nil {
		return err
	}

	domains := map[string]bool{}
	if user.MainDomain != "" {
		domains[user.MainDomain] = true
	}
	if facades.Orm() != nil {
		var sites []models.Website
		if err := facades.Orm().Query().Where("owner_username = ?", username).Find(&sites); err == nil {
			for _, s := range sites {
				domains[s.Domain] = true
			}
		}
	}

	nginx := services.NewNginxService()
	mail := services.NewEmailService()
	web := GetOrchestrator()
	for d := range domains {
		for _, prefix := range serviceSubdomainPrefixes {
			_ = nginx.DeleteWebsite(prefix + d)
		}
		for _, acct := range mail.ListAccounts(d) {
			_ = mail.DeleteAccount(acct.Email)
		}
		_ = web.DeprovisionWebsite(ctx, d)
	}

	services.NewPHPManagerService().RemoveUserFPMPools(username)
	services.RemoveAccountCLIVersion(username)
	services.RemovePHPCGIWrappers(username)
	return uas.DeleteUser(username)
}
