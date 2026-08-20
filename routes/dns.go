package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerDNSRoutes(dnsController *controllers.DNSController) {
	// DNS Root Server, BIND 9 Engine, Zones & Security Management API
	facades.Route().Get("/api/dns/zones", dnsController.Index)
	facades.Route().Get("/api/dns/zone", dnsController.GetZone)
	facades.Route().Post("/api/dns/zone/create", dnsController.CreateZone)
	facades.Route().Post("/api/dns/zone/delete", dnsController.DeleteZone)
	facades.Route().Post("/api/dns/record", dnsController.StoreRecord)
	facades.Route().Post("/api/dns/record/delete", dnsController.DeleteRecord)
	facades.Route().Post("/api/dns/zone/reset", dnsController.ResetZone)
	facades.Route().Get("/api/dns/settings", dnsController.GetSettings)
	facades.Route().Post("/api/dns/settings", dnsController.SaveSettings)
	facades.Route().Post("/api/dns/hostname", dnsController.UpdateHostname)
	facades.Route().Get("/api/dns/zone/raw", dnsController.ExportRawZone)
	facades.Route().Post("/api/dns/zone/raw", dnsController.SaveRawZone)
	facades.Route().Post("/api/dns/cloudflare/sync", dnsController.SyncCloudflare)
	facades.Route().Get("/api/dns/server/status", dnsController.GetBindDaemon)
	facades.Route().Post("/api/dns/server/control", dnsController.ControlBind)
	facades.Route().Post("/api/dns/server/rebuild", dnsController.RebuildZones)
	facades.Route().Get("/api/dns/server/options", dnsController.GetBindOptions)
	facades.Route().Post("/api/dns/server/options", dnsController.SaveBindOptions)
	facades.Route().Get("/api/dns/server/logs", dnsController.GetBindLogs)
	facades.Route().Get("/api/dns/template", dnsController.GetTemplate)
	facades.Route().Get("/api/dns/templates", dnsController.ListTemplates)
	facades.Route().Post("/api/dns/template", dnsController.SaveTemplate)
	facades.Route().Post("/api/dns/template/delete", dnsController.DeleteTemplate)
	facades.Route().Post("/api/dns/template/default", dnsController.SetDefaultTemplate)
	facades.Route().Post("/api/dns/zone/apply-template", dnsController.ApplyTemplate)
	facades.Route().Post("/api/dns/zone/owner", dnsController.ChangeZoneOwner)
	facades.Route().Post("/api/dns/bulk-migrate-ip", dnsController.BulkMigrateIP)
	facades.Route().Post("/api/dns/diagnose", dnsController.Diagnose)
	facades.Route().Get("/api/dns/dnssec", dnsController.GetDNSSEC)
	facades.Route().Post("/api/dns/dnssec/toggle", dnsController.ToggleDNSSEC)
	facades.Route().Get("/api/dns/cluster", dnsController.ListCluster)
	facades.Route().Post("/api/dns/cluster/node", dnsController.SaveClusterNode)
	facades.Route().Post("/api/dns/cluster/node/delete", dnsController.DeleteClusterNode)
	facades.Route().Post("/api/dns/cluster/sync", dnsController.SyncCluster)
}
