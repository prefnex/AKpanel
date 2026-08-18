package controllers

import (
	"github.com/goravel/framework/contracts/http"
	"goravel/app/services"
)

type IPsController struct {
	ipService *services.IPService
}

func NewIPsController() *IPsController {
	return &IPsController{
		ipService: services.NewIPService(),
	}
}

// Index lists all IP addresses
func (r *IPsController) Index(ctx http.Context) http.Response {
	ips, err := r.ipService.GetIPs()
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to fetch IP pool: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   ips,
	})
}

// Store adds a new IPv4 or IPv6 address and binds it to an interface
func (r *IPsController) Store(ctx http.Context) http.Response {
	ip := ctx.Request().Input("ip")
	netmask := ctx.Request().Input("netmask", "255.255.255.0")
	gateway := ctx.Request().Input("gateway")
	iface := ctx.Request().Input("interface")
	role := ctx.Request().Input("role", "shared")
	assignedTo := ctx.Request().Input("assigned_to")

	if ip == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "IP address is required",
		})
	}

	newItem, err := r.ipService.AddIP(ip, netmask, gateway, iface, role, assignedTo)
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(201).Json(http.Json{
		"status":  "success",
		"message": "IP address added and bound successfully",
		"data":    newItem,
	})
}

// Destroy deletes an IP address and unbinds it
func (r *IPsController) Destroy(ctx http.Context) http.Response {
	ip := ctx.Request().Input("ip")
	if ip == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "IP address is required",
		})
	}

	if err := r.ipService.DeleteIP(ip); err != nil {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "IP address removed successfully",
	})
}

// SetRole changes role of an IP (main, shared, dedicated)
func (r *IPsController) SetRole(ctx http.Context) http.Response {
	ip := ctx.Request().Input("ip")
	role := ctx.Request().Input("role")
	assignedTo := ctx.Request().Input("assigned_to")

	if ip == "" || role == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "IP and role are required",
		})
	}

	if err := r.ipService.SetRole(ip, role, assignedTo); err != nil {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "IP role updated successfully",
	})
}
