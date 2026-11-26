package provisioning

import (
	"context"
	"errors"
	"testing"

	"goravel/app/domain"
	"goravel/app/paths"
	"goravel/app/services"
)

type FailingStep struct {
	executed   bool
	rolledBack bool
}

func (f *FailingStep) Name() string { return "FailingStep" }
func (f *FailingStep) Execute(ctx context.Context, plan *ProvisionPlan) error {
	f.executed = true
	return errors.New("simulated failure")
}
func (f *FailingStep) Rollback(ctx context.Context, plan *ProvisionPlan) error {
	f.rolledBack = true
	return nil
}

type TrackingStep struct {
	executed   bool
	rolledBack bool
}

func (t *TrackingStep) Name() string { return "TrackingStep" }
func (t *TrackingStep) Execute(ctx context.Context, plan *ProvisionPlan) error {
	t.executed = true
	return nil
}
func (t *TrackingStep) Rollback(ctx context.Context, plan *ProvisionPlan) error {
	t.rolledBack = true
	return nil
}

func TestValidatePlanStep(t *testing.T) {
	step := &ValidatePlanStep{}
	ctx := context.Background()

	// 1. Empty domain must fail
	plan := &ProvisionPlan{Domain: ""}
	if err := step.Execute(ctx, plan); err == nil {
		t.Error("expected error for empty domain, got nil")
	}

	// 2. Normalization check
	validPlan := &ProvisionPlan{
		Domain:        "  MySite.COM  ",
		Backend:       domain.Backend("nginx+apache"),
		PHPVersion:    "",
		OwnerUsername: "",
	}
	if err := step.Execute(ctx, validPlan); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if validPlan.Domain != "mysite.com" {
		t.Errorf("expected normalized domain 'mysite.com', got '%s'", validPlan.Domain)
	}
	if validPlan.OwnerUsername != "root" {
		t.Errorf("expected default owner 'root', got '%s'", validPlan.OwnerUsername)
	}
	if validPlan.Backend != domain.BackendApache {
		t.Errorf("expected legacy 'nginx+apache' to mean backend apache, got '%s'", validPlan.Backend)
	}
	eff := domain.ResolveStack(services.CurrentMode(), domain.SiteStack{SiteType: "php", Backend: validPlan.Backend}, false)
	if want := paths.DefaultPHPVersionFor(string(eff.Backend)); validPlan.PHPVersion != want {
		t.Errorf("expected server default PHP %q, got %q", want, validPlan.PHPVersion)
	}
}
