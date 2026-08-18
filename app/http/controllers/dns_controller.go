package controllers

import (
	"strconv"

	goravelhttp "github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type DNSController struct {
	dnsService *services.DNSService
}

func NewDNSController() *DNSController {
	return &DNSController{
		dnsService: services.NewDNSService(),
	}
}

type AddRecordRequest struct {
	Domain   string `json:"domain"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Value    string `json:"value"`
	TTL      int    `json:"ttl"`
	Priority int    `json:"priority"`
	Comment  string `json:"comment"`
}

type CreateZoneRequest struct {
	Domain     string `json:"domain"`
	ServerIP   string `json:"server_ip"`
	OwnerUser  string `json:"owner_user"`
	TemplateID string `json:"template_id"`
}

type ChangeOwnerRequest struct {
	Domain   string `json:"domain"`
	NewOwner string `json:"new_owner"`
}

type ApplyTemplateRequest struct {
	Domain     string `json:"domain"`
	TemplateID string `json:"template_id"`
}

type SaveRawZoneRequest struct {
	Domain     string `json:"domain"`
	RawContent string `json:"raw_content"`
}

type HostnameRequest struct {
	Hostname string `json:"hostname"`
}

type BindControlRequest struct {
	Action string `json:"action"` // start, stop, restart, reload, flush_cache, checkconf
}

type BulkMigrateIPRequest struct {
	OldIP string `json:"old_ip"`
	NewIP string `json:"new_ip"`
}

type DiagnoseDNSRequest struct {
	Domain     string `json:"domain"`
	RecordType string `json:"record_type"`
	Server     string `json:"server"`
}

type DNSSECToggleRequest struct {
	Domain string `json:"domain"`
	Enable bool   `json:"enable"`
}

// Index lists all DNS zones across all users and root
func (c *DNSController) Index(ctx goravelhttp.Context) goravelhttp.Response {
	zones := c.dnsService.ListZones()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   zones,
	})
}

// CreateZone adds a brand new DNS zone with an owner user
func (c *DNSController) CreateZone(ctx goravelhttp.Context) goravelhttp.Response {
	var req CreateZoneRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	ip := req.ServerIP
	if ip == "" {
		ip = c.dnsService.GetSystemIP()
	}
	owner := req.OwnerUser
	if owner == "" {
		owner = "root"
	}

	zone, err := c.dnsService.CreateZone(req.Domain, ip, owner, req.TemplateID)
	if err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "DNS Zone for " + req.Domain + " (Owner: " + owner + ") provisioned and synced to BIND 9!",
		"data":    zone,
	})
}

// DeleteZone permanently removes a DNS zone
func (c *DNSController) DeleteZone(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Input("domain")
	if domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	if err := c.dnsService.DeleteZone(domain); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "DNS Zone for " + domain + " permanently removed from BIND 9!",
	})
}

// ChangeZoneOwner transfers zone ownership
func (c *DNSController) ChangeZoneOwner(ctx goravelhttp.Context) goravelhttp.Response {
	var req ChangeOwnerRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	if err := c.dnsService.ChangeZoneOwner(req.Domain, req.NewOwner); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Zone ownership for " + req.Domain + " transferred to " + req.NewOwner + "!",
	})
}

// ApplyTemplate applies a template to an existing zone
func (c *DNSController) ApplyTemplate(ctx goravelhttp.Context) goravelhttp.Response {
	var req ApplyTemplateRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" || req.TemplateID == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain and Template ID are required",
		})
	}

	zone, err := c.dnsService.ApplyTemplateToZone(req.Domain, req.TemplateID)
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Template successfully applied to " + req.Domain + " and propagated to BIND 9!",
		"data":    zone,
	})
}

// GetZone retrieves records for a specific domain
func (c *DNSController) GetZone(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Input("domain")
	if domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	zone, err := c.dnsService.GetZone(domain)
	if err != nil {
		zone, _ = c.dnsService.CreateZone(domain, c.dnsService.GetSystemIP(), "root", "")
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   zone,
	})
}

// StoreRecord adds a DNS record
func (c *DNSController) StoreRecord(ctx goravelhttp.Context) goravelhttp.Response {
	var req AddRecordRequest
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid request payload",
		})
	}

	if req.Domain == "" || req.Type == "" || req.Value == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain, Type, and Value are required",
		})
	}

	record := services.DNSRecord{
		Name:     req.Name,
		Type:     req.Type,
		Value:    req.Value,
		TTL:      req.TTL,
		Priority: req.Priority,
		Comment:  req.Comment,
	}

	if err := c.dnsService.AddRecord(req.Domain, record); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "DNS record saved and propagated to BIND 9 successfully!",
	})
}

// DeleteRecord deletes a DNS record
func (c *DNSController) DeleteRecord(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Input("domain")
	indexStr := ctx.Request().Input("index")

	index, err := strconv.Atoi(indexStr)
	if err != nil || domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Valid domain and index required",
		})
	}

	if err := c.dnsService.DeleteRecord(domain, index); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "DNS record deleted successfully!",
	})
}

// ResetZone resets DNS zone to default template
func (c *DNSController) ResetZone(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Input("domain")
	if domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	zone, err := c.dnsService.ResetZone(domain)
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"data":    zone,
		"message": "DNS zone reset to default AKpanel Master template with SPF/DKIM/DMARC/CAA!",
	})
}

// GetSettings returns global Nameserver, Hostname and Cloudflare settings
func (c *DNSController) GetSettings(ctx goravelhttp.Context) goravelhttp.Response {
	settings := c.dnsService.GetSettings()
	glueRecords := c.dnsService.GetGlueRecords()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":       "success",
		"settings":     settings,
		"glue_records": glueRecords,
		"server_ip":    c.dnsService.GetSystemIP(),
	})
}

// SaveSettings updates global DNS, Nameservers and Cloudflare settings
func (c *DNSController) SaveSettings(ctx goravelhttp.Context) goravelhttp.Response {
	var settings services.DNSSettings
	if err := ctx.Request().Bind(&settings); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid settings payload",
		})
	}

	if err := c.dnsService.SaveSettings(settings); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":   "success",
		"message":  "Nameserver and DNS settings saved successfully!",
		"settings": settings,
	})
}

// UpdateHostname updates the Linux system hostname
func (c *DNSController) UpdateHostname(ctx goravelhttp.Context) goravelhttp.Response {
	var req HostnameRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Hostname == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Hostname is required",
		})
	}

	if err := c.dnsService.SetHostname(req.Hostname); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":   "success",
		"message":  "Server hostname updated to " + req.Hostname + " successfully!",
		"hostname": req.Hostname,
	})
}

// ExportRawZone returns RFC 1035 zone file content for Monaco Editor
func (c *DNSController) ExportRawZone(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Query("domain")
	if domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	raw, err := c.dnsService.ExportZoneFile(domain)
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"domain":  domain,
		"content": raw,
	})
}

// SaveRawZone parses and applies raw zone file content from Monaco Editor
func (c *DNSController) SaveRawZone(ctx goravelhttp.Context) goravelhttp.Response {
	var req SaveRawZoneRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" || req.RawContent == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain and raw_content are required",
		})
	}

	zone, err := c.dnsService.ImportZoneFile(req.Domain, req.RawContent)
	if err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Zone Syntax Error: " + err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Zone file parsed, validated with BIND 9, and synchronized!",
		"data":    zone,
	})
}

// SyncCloudflare synchronizes records with Cloudflare DNS API
func (c *DNSController) SyncCloudflare(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Input("domain")
	if domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	result, err := c.dnsService.SyncCloudflare(domain)
	if err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "DNS records synchronized with Cloudflare successfully!",
		"data":    result,
	})
}

// GetBindDaemon returns status of BIND 9 server daemon
func (c *DNSController) GetBindDaemon(ctx goravelhttp.Context) goravelhttp.Response {
	status := c.dnsService.GetBindDaemonStatus()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   status,
	})
}

// ControlBind controls BIND 9 daemon (start, stop, restart, reload, flush_cache, checkconf)
func (c *DNSController) ControlBind(ctx goravelhttp.Context) goravelhttp.Response {
	var req BindControlRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Action == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Action is required",
		})
	}

	if err := c.dnsService.ControlBindService(req.Action); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "BIND 9 action '" + req.Action + "' executed successfully!",
	})
}

// RebuildZones regenerates all BIND 9 zones
func (c *DNSController) RebuildZones(ctx goravelhttp.Context) goravelhttp.Response {
	count, err := c.dnsService.RebuildAllZones()
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Successfully rebuilt " + strconv.Itoa(count) + " BIND 9 zone files and reloaded daemon!",
		"count":   count,
	})
}

// GetBindOptions returns named.conf.options parameters
func (c *DNSController) GetBindOptions(ctx goravelhttp.Context) goravelhttp.Response {
	opts := c.dnsService.GetBindOptions()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   opts,
	})
}

// SaveBindOptions saves named.conf.options parameters
func (c *DNSController) SaveBindOptions(ctx goravelhttp.Context) goravelhttp.Response {
	var opts services.BindServerOptions
	if err := ctx.Request().Bind(&opts); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid options payload",
		})
	}

	if err := c.dnsService.SaveBindOptions(opts); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "BIND 9 Server Options saved and applied to named.conf.options!",
		"data":    opts,
	})
}

// GetBindLogs returns logs from named/bind9
func (c *DNSController) GetBindLogs(ctx goravelhttp.Context) goravelhttp.Response {
	logs := c.dnsService.GetBindLogs()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   logs,
	})
}

// ListTemplates returns all DNS zone templates
func (c *DNSController) ListTemplates(ctx goravelhttp.Context) goravelhttp.Response {
	tpls := c.dnsService.ListTemplates()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   tpls,
	})
}

// GetTemplate returns a single template
func (c *DNSController) GetTemplate(ctx goravelhttp.Context) goravelhttp.Response {
	id := ctx.Request().Query("id")
	tpl, err := c.dnsService.GetTemplate(id)
	if err != nil {
		return ctx.Response().Status(404).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   tpl,
	})
}

// SaveTemplate saves or updates a template
func (c *DNSController) SaveTemplate(ctx goravelhttp.Context) goravelhttp.Response {
	var tpl services.DNSZoneTemplate
	if err := ctx.Request().Bind(&tpl); err != nil || tpl.Name == "" || tpl.Content == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Template Name and Content are required",
		})
	}

	if err := c.dnsService.SaveTemplate(tpl); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "DNS Zone Template saved successfully!",
	})
}

// DeleteTemplate removes a template
func (c *DNSController) DeleteTemplate(ctx goravelhttp.Context) goravelhttp.Response {
	id := ctx.Request().Input("id")
	if id == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Template ID is required",
		})
	}

	if err := c.dnsService.DeleteTemplate(id); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "DNS Zone Template deleted successfully!",
	})
}

// SetDefaultTemplate sets default template
func (c *DNSController) SetDefaultTemplate(ctx goravelhttp.Context) goravelhttp.Response {
	id := ctx.Request().Input("id")
	if id == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Template ID is required",
		})
	}

	if err := c.dnsService.SetDefaultTemplate(id); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Default DNS Zone Template updated!",
	})
}

// BulkMigrateIP executes server-wide IP migration across all zones
func (c *DNSController) BulkMigrateIP(ctx goravelhttp.Context) goravelhttp.Response {
	var req BulkMigrateIPRequest
	if err := ctx.Request().Bind(&req); err != nil || req.OldIP == "" || req.NewIP == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Both old_ip and new_ip are required",
		})
	}

	count, err := c.dnsService.BulkIPMigration(req.OldIP, req.NewIP)
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Successfully migrated IP address across " + strconv.Itoa(count) + " DNS zones in BIND 9!",
		"count":   count,
	})
}

// Diagnose executes dig / nslookup
func (c *DNSController) Diagnose(ctx goravelhttp.Context) goravelhttp.Response {
	var req DiagnoseDNSRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	result, err := c.dnsService.DiagnoseDNS(req.Domain, req.RecordType, req.Server)
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   result,
	})
}

// GetDNSSEC returns DNSSEC keys & DS record
func (c *DNSController) GetDNSSEC(ctx goravelhttp.Context) goravelhttp.Response {
	domain := ctx.Request().Query("domain", "default.local")
	summary := c.dnsService.GetDNSSECSummary(domain)
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   summary,
	})
}

// ToggleDNSSEC enables or disables DNSSEC for a domain
func (c *DNSController) ToggleDNSSEC(ctx goravelhttp.Context) goravelhttp.Response {
	var req DNSSECToggleRequest
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Domain is required",
		})
	}

	if err := c.dnsService.ToggleDNSSEC(req.Domain, req.Enable); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	statusStr := "disabled"
	if req.Enable {
		statusStr = "enabled & signed with ECDSA P-256"
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "DNSSEC " + statusStr + " for domain " + req.Domain + "!",
	})
}

// ListCluster returns all DNS cluster slave nodes
func (c *DNSController) ListCluster(ctx goravelhttp.Context) goravelhttp.Response {
	nodes := c.dnsService.ListClusterNodes()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   nodes,
	})
}

// SaveClusterNode saves a slave DNS node
func (c *DNSController) SaveClusterNode(ctx goravelhttp.Context) goravelhttp.Response {
	var node services.DNSClusterNode
	if err := ctx.Request().Bind(&node); err != nil || node.IP == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Node IP is required",
		})
	}

	if err := c.dnsService.SaveClusterNode(node); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "DNS Cluster Slave Node saved successfully!",
	})
}

// DeleteClusterNode deletes a slave node
func (c *DNSController) DeleteClusterNode(ctx goravelhttp.Context) goravelhttp.Response {
	id := ctx.Request().Input("id")
	if id == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Node ID is required",
		})
	}

	if err := c.dnsService.DeleteClusterNode(id); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "DNS Cluster Node removed successfully!",
	})
}

// SyncCluster synchronizes all zones across cluster
func (c *DNSController) SyncCluster(ctx goravelhttp.Context) goravelhttp.Response {
	count, err := c.dnsService.SyncCluster()
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Successfully synchronized " + strconv.Itoa(count) + " DNS zones across all cluster slave nodes!",
	})
}
