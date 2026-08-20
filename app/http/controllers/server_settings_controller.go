package controllers

import (
	"github.com/goravel/framework/contracts/http"
	"goravel/app/services"
)

type ServerSettingsController struct {
	settingsService *services.ServerSettingsService
}

func NewServerSettingsController() *ServerSettingsController {
	return &ServerSettingsController{
		settingsService: services.NewServerSettingsService(),
	}
}

// GetSettings retrieves current server and panel settings
func (r *ServerSettingsController) GetSettings(ctx http.Context) http.Response {
	settings, err := r.settingsService.GetSettings()
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to load settings: " + err.Error(),
		})
	}

	sslInfo, _ := r.settingsService.GetHostnameSSL()

	return ctx.Response().Success().Json(http.Json{
		"status":       "success",
		"data":         settings,
		"hostname_ssl": sslInfo,
	})
}

// SaveSettings updates server settings
func (r *ServerSettingsController) SaveSettings(ctx http.Context) http.Response {
	var settings services.ServerSettings
	if err := ctx.Request().Bind(&settings); err != nil {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Invalid settings payload",
		})
	}

	if err := r.settingsService.SaveSettings(settings); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to save settings: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Server settings saved successfully",
		"data":    settings,
	})
}

// IssueHostnameSSL triggers Hostname SSL certificate issuance/renewal
func (r *ServerSettingsController) IssueHostnameSSL(ctx http.Context) http.Response {
	email := ctx.Request().Input("email")
	sslInfo, err := r.settingsService.IssueHostnameSSL(email)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": "Failed to configure Hostname SSL: " + err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": sslInfo.Message,
		"data":    sslInfo,
	})
}

// SaveCustomHostnameSSL installs a custom SSL certificate and private key for the panel hostname
func (r *ServerSettingsController) SaveCustomHostnameSSL(ctx http.Context) http.Response {
	cert := ctx.Request().Input("certificate")
	key := ctx.Request().Input("private_key")

	if cert == "" || key == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Both certificate and private key are required",
		})
	}

	sslInfo, err := r.settingsService.SaveCustomHostnameSSL(cert, key)
	if err != nil {
		return ctx.Response().Status(400).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Custom Hostname SSL certificate installed successfully",
		"data":    sslInfo,
	})
}
