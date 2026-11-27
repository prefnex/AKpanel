package controllers

import (
	"fmt"
	"strings"

	"github.com/goravel/framework/contracts/http"
	"goravel/app/paths"
	"goravel/app/services"
)

type PHPController struct {
	phpService *services.PHPManagerService
}

func NewPHPController() *PHPController {
	return &PHPController{
		phpService: services.NewPHPManagerService(),
	}
}

func phpFail(ctx http.Context, status int, err error) http.Response {
	return ctx.Response().Status(status).Json(http.Json{"status": "error", "message": err.Error()})
}

func phpOK(ctx http.Context, payload http.Json) http.Response {
	payload["status"] = "success"
	return ctx.Response().Success().Json(payload)
}

// phpVersionInput reads "version", defaulting to the server default, and validates it.
func phpVersionInput(ctx http.Context, required bool) (string, error) {
	v := strings.TrimSpace(ctx.Request().Input("version"))
	if v == "" && !required {
		v = paths.DefaultPHPVersion()
	}
	if !paths.IsPHPVersionString(v) {
		return "", fmt.Errorf("a valid PHP version is required")
	}
	return v, nil
}

// Index returns all supported PHP versions details and installed extension matrix
func (r *PHPController) Index(ctx http.Context) http.Response {
	return phpOK(ctx, http.Json{
		"data":    r.phpService.GetAllVersionsDetails(),
		"cli":     r.phpService.GetCLIOverview(),
		"default": paths.DefaultPHPVersion(),
	})
}

// PHPInfo returns parsed phpinfo sections
func (r *PHPController) PHPInfo(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, false)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	sections, err := r.phpService.GetPHPInfo(version)
	if err != nil {
		return phpFail(ctx, 500, err)
	}
	return phpOK(ctx, http.Json{"data": sections})
}

// GetRawIni gets raw php.ini content (sapi=fpm|cli)
func (r *PHPController) GetRawIni(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, false)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	sapi := ctx.Request().Input("sapi", "fpm")
	content, err := r.phpService.GetRawIni(version, sapi)
	if err != nil {
		return phpFail(ctx, 500, err)
	}
	return phpOK(ctx, http.Json{"content": content, "path": fmt.Sprintf("/etc/php/%s/%s/php.ini", version, sapi)})
}

// SaveRawIni saves raw php.ini content
func (r *PHPController) SaveRawIni(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	sapi := ctx.Request().Input("sapi", "fpm")
	if err := r.phpService.SaveRawIni(version, sapi, ctx.Request().Input("content")); err != nil {
		return phpFail(ctx, 422, err)
	}
	return phpOK(ctx, http.Json{"message": fmt.Sprintf("PHP %s %s php.ini saved (backup kept as php.ini.akpanel.bak)", version, sapi)})
}

// GetIniSettings returns the managed php.ini directives with current values.
func (r *PHPController) GetIniSettings(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, false)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	settings, err := r.phpService.GetIniSettings(version, ctx.Request().Input("sapi", "fpm"))
	if err != nil {
		return phpFail(ctx, 500, err)
	}
	return phpOK(ctx, http.Json{"data": settings})
}

// UpdateIni saves managed php.ini directives: {version, targets: ["fpm","cli"], settings: {k: v}}.
func (r *PHPController) UpdateIni(ctx http.Context) http.Response {
	var req struct {
		Version  string            `json:"version"`
		Targets  []string          `json:"targets"`
		Settings map[string]string `json:"settings"`
	}
	if err := ctx.Request().Bind(&req); err != nil {
		return phpFail(ctx, 422, err)
	}
	if len(req.Settings) == 0 {
		return phpFail(ctx, 422, fmt.Errorf("nothing to save"))
	}
	if err := r.phpService.SaveIniSettings(strings.TrimSpace(req.Version), req.Targets, req.Settings); err != nil {
		return phpFail(ctx, 422, err)
	}
	return phpOK(ctx, http.Json{"message": fmt.Sprintf("php.ini for PHP %s updated and FPM reloaded", req.Version)})
}

// GetFpmPool gets the shared www pool plus a summary of account pools.
func (r *PHPController) GetFpmPool(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, false)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	cfg, err := r.phpService.GetFpmPoolConfig(version)
	if err != nil {
		return phpFail(ctx, 500, err)
	}
	return phpOK(ctx, http.Json{"data": cfg, "account_pools": r.phpService.ListAccountPools(version)})
}

// SaveFpmPool saves the shared www pool configuration
func (r *PHPController) SaveFpmPool(ctx http.Context) http.Response {
	var cfg services.FpmPoolConfig
	if err := ctx.Request().Bind(&cfg); err != nil {
		return phpFail(ctx, 422, err)
	}
	if err := r.phpService.SaveFpmPoolConfig(&cfg); err != nil {
		return phpFail(ctx, 422, err)
	}
	return phpOK(ctx, http.Json{"message": fmt.Sprintf("PHP %s www pool saved and FPM restarted", cfg.Version)})
}

// StartLiveInstall starts a live install task with progress streaming
func (r *PHPController) StartLiveInstall(ctx http.Context) http.Response {
	req := services.LiveInstallRequest{
		Type:    ctx.Request().Input("type", "version"), // version | extension | ffmpeg | addon
		Version: strings.TrimSpace(ctx.Request().Input("version")),
		Name:    ctx.Request().Input("name", ""),
	}
	for _, p := range strings.Split(ctx.Request().Input("packages"), ",") {
		if p = strings.TrimSpace(strings.ToLower(p)); p != "" {
			req.Packages = append(req.Packages, p)
		}
	}
	taskID, title, err := r.phpService.StartLiveInstall(req)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	return phpOK(ctx, http.Json{"task_id": taskID, "title": title})
}

// Uninstall removes a PHP version (live task) when nothing uses it.
func (r *PHPController) Uninstall(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	taskID, err := r.phpService.StartUninstall(version)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	return phpOK(ctx, http.Json{"task_id": taskID, "title": fmt.Sprintf("Remove PHP %s", version)})
}

// Usage lists websites and accounts running on a version.
func (r *PHPController) Usage(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	return phpOK(ctx, http.Json{"data": r.phpService.VersionUsage(version)})
}

// Packages reports which php<ver>-* packages are installable on this release.
func (r *PHPController) Packages(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	opts, err := r.phpService.PackageOptions(version)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	return phpOK(ctx, http.Json{"data": opts})
}

// GetTaskStatus returns live real-time task progress and logs
func (r *PHPController) GetTaskStatus(ctx http.Context) http.Response {
	task := r.phpService.GetTask(ctx.Request().Input("task_id"))
	if task == nil {
		return phpFail(ctx, 404, fmt.Errorf("task not found"))
	}
	return phpOK(ctx, http.Json{"data": task})
}

// InstallVersion installs a PHP version directly
func (r *PHPController) InstallVersion(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	if err := r.phpService.InstallVersion(version); err != nil {
		return phpFail(ctx, 500, err)
	}
	return phpOK(ctx, http.Json{"message": fmt.Sprintf("PHP %s installed successfully", version)})
}

// ToggleExtension installs (enable) or removes (disable) an extension package.
func (r *PHPController) ToggleExtension(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	extension := ctx.Request().Input("extension")
	if err := r.phpService.ToggleExtension(version, extension, ctx.Request().InputBool("enable", true)); err != nil {
		return phpFail(ctx, 500, err)
	}
	return phpOK(ctx, http.Json{"message": fmt.Sprintf("Extension '%s' updated for PHP %s", extension, version)})
}

// SetExtensionState switches an installed module on/off (phpenmod/phpdismod).
func (r *PHPController) SetExtensionState(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	ext := ctx.Request().Input("extension")
	enabled := ctx.Request().InputBool("enabled", true)
	if err := r.phpService.SetExtensionState(version, ext, enabled); err != nil {
		return phpFail(ctx, 422, err)
	}
	state := "disabled"
	if enabled {
		state = "enabled"
	}
	return phpOK(ctx, http.Json{"message": fmt.Sprintf("%s %s for PHP %s", ext, state, version)})
}

func (r *PHPController) RestartFPM(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	if err := r.phpService.RestartFPM(version); err != nil {
		return phpFail(ctx, 500, err)
	}
	return phpOK(ctx, http.Json{"message": fmt.Sprintf("PHP %s FPM restarted", version)})
}

// FPMService runs start | stop | restart | reload on a version's FPM.
func (r *PHPController) FPMService(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	action := ctx.Request().Input("action")
	if err := r.phpService.FPMServiceAction(version, action); err != nil {
		return phpFail(ctx, 422, err)
	}
	return phpOK(ctx, http.Json{"message": fmt.Sprintf("php%s-fpm: %s done", version, action)})
}

// SetDefaultCLI sets the system-wide default PHP CLI binary via update-alternatives.
func (r *PHPController) SetDefaultCLI(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	if err := r.phpService.SetDefaultCLI(version); err != nil {
		return phpFail(ctx, 500, err)
	}
	return phpOK(ctx, http.Json{
		"message": fmt.Sprintf("System default PHP CLI set to %s", version),
		"cli":     r.phpService.GetCLIOverview(),
	})
}

func (r *PHPController) SetDefaultFPM(ctx http.Context) http.Response {
	version, err := phpVersionInput(ctx, true)
	if err != nil {
		return phpFail(ctx, 422, err)
	}
	if err := r.phpService.SetDefaultFPM(version); err != nil {
		return phpFail(ctx, 500, err)
	}
	return phpOK(ctx, http.Json{"message": fmt.Sprintf("Default PHP-FPM for new sites set to %s", version)})
}
