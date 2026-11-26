package controllers

import (
	"context"
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
	"goravel/app/services/provisioning"
)

// SubdomainsController: add, list and delete subdomains (CWP's Add/List SubDomains).
type SubdomainsController struct{}

func NewSubdomainsController() *SubdomainsController { return &SubdomainsController{} }

// Index lists subdomain sites (?owner= filters by account).
func (r *SubdomainsController) Index(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": services.ListSubdomains(strings.TrimSpace(ctx.Request().Query("owner")))})
}

// Store creates name.parent for the parent's owner.
func (r *SubdomainsController) Store(ctx http.Context) http.Response {
	var req provisioning.SubdomainRequest
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "invalid request: " + err.Error()})
	}
	res, err := provisioning.GetOrchestrator().CreateSubdomain(context.Background(), req)
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	msg := res.Website.Domain + " created. " + res.DNS
	if res.SSLTaskID != "" {
		msg += ". Certificate requested."
	}
	return ctx.Response().Status(201).Json(http.Json{"status": "success", "message": msg, "data": res})
}

// Destroy deletes a subdomain site and its DNS record (files are kept).
func (r *SubdomainsController) Destroy(ctx http.Context) http.Response {
	d := strings.ToLower(strings.TrimSpace(ctx.Request().Input("domain")))
	if err := provisioning.GetOrchestrator().DeleteSubdomain(context.Background(), d); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": d + " deleted (its files were kept)"})
}
