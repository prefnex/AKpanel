package controllers

import (
	"fmt"
	"strings"

	"github.com/goravel/framework/contracts/http"
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

// Index returns all supported PHP versions details and installed extension matrix
func (r *PHPController) Index(ctx http.Context) http.Response {
	details := r.phpService.GetAllVersionsDetails()
	overview := r.phpService.GetCLIOverview()
	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"data":    details,
		"cli":     overview,
	})
}

// PHPInfo returns parsed phpinfo sections
func (r *PHPController) PHPInfo(ctx http.Context) http.Response {
	version := ctx.Request().Input("version", "8.2")
	sections, err := r.phpService.GetPHPInfo(version)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   sections,
	})
}

// GetRawIni gets raw php.ini content
func (r *PHPController) GetRawIni(ctx http.Context) http.Response {
	version := ctx.Request().Input("version", "8.2")
	content, err := r.phpService.GetRawIni(version)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"content": content,
	})
}

// SaveRawIni saves raw php.ini content
func (r *PHPController) SaveRawIni(ctx http.Context) http.Response {
	version := ctx.Request().Input("version")
	content := ctx.Request().Input("content")

	if version == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "version is required",
		})
	}

	if err := r.phpService.SaveRawIni(version, content); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("php.ini for PHP %s saved and FPM reloaded successfully", version),
	})
}

// GetFpmPool gets FPM pool configuration
func (r *PHPController) GetFpmPool(ctx http.Context) http.Response {
	version := ctx.Request().Input("version", "8.2")
	cfg, err := r.phpService.GetFpmPoolConfig(version)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   cfg,
	})
}

// SaveFpmPool saves FPM pool configuration
func (r *PHPController) SaveFpmPool(ctx http.Context) http.Response {
	var cfg services.FpmPoolConfig
	cfg.Version = ctx.Request().Input("version")
	cfg.Pm = ctx.Request().Input("pm", "dynamic")
	cfg.MaxChildren = ctx.Request().Input("max_children", "50")
	cfg.StartServers = ctx.Request().Input("start_servers", "5")
	cfg.MinSpareServers = ctx.Request().Input("min_spare_servers", "5")
	cfg.MaxSpareServers = ctx.Request().Input("max_spare_servers", "35")
	cfg.MaxRequests = ctx.Request().Input("max_requests", "500")

	if cfg.Version == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "version is required",
		})
	}

	if err := r.phpService.SaveFpmPoolConfig(&cfg); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("PHP %s FPM pool updated and restarted successfully", cfg.Version),
	})
}

// StartLiveInstall starts a live install task with progress streaming
func (r *PHPController) StartLiveInstall(ctx http.Context) http.Response {
	version := ctx.Request().Input("version")
	itemType := ctx.Request().Input("type", "version") // "version", "extension", "ffmpeg", "addon"
	name := ctx.Request().Input("name", "")

	packagesRaw := ctx.Request().Input("packages")
	var title, cmdStr string
	switch itemType {
	case "version":
		title = fmt.Sprintf("PHP %s Installation", version)
		pkgs := []string{"cli", "fpm", "common", "mysql", "curl", "mbstring", "xml", "zip", "gd", "sqlite3"}
		if packagesRaw != "" {
			pkgs = []string{}
			for _, p := range strings.Split(packagesRaw, ",") {
				p = strings.TrimSpace(strings.ToLower(p))
				if p != "" {
					pkgs = append(pkgs, p)
				}
			}
		}
		apt := "apt-get update -qq && apt-get install -y"
		for _, p := range pkgs {
			apt += fmt.Sprintf(" php%s-%s", version, p)
		}
		apt += fmt.Sprintf(" && service php%s-fpm start", version)
		cmdStr = apt
	case "extension":
		title = fmt.Sprintf("Extension '%s' for PHP %s", name, version)
		cmdStr = fmt.Sprintf("apt-get install -y php%s-%s && service php%s-fpm restart", version, name, version)
	case "ffmpeg":
		title = "FFMPEG & Media Transcoding Engine"
		cmdStr = "apt-get update -qq && apt-get install -y ffmpeg libavcodec-extra"
	case "addon":
		title = fmt.Sprintf("PHP Addon '%s'", name)
		cmdStr = fmt.Sprintf("apt-get install -y php%s-%s && service php%s-fpm restart", version, name, version)
	default:
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "invalid type",
		})
	}

	taskID := r.phpService.StartLiveInstallTask(title, cmdStr)
	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"task_id": taskID,
		"title":   title,
	})
}

// GetTaskStatus returns live real-time task progress and logs
func (r *PHPController) GetTaskStatus(ctx http.Context) http.Response {
	taskID := ctx.Request().Input("task_id")
	task := r.phpService.GetTask(taskID)
	if task == nil {
		return ctx.Response().Status(404).Json(http.Json{
			"status":  "error",
			"message": "task not found",
		})
	}
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   task,
	})
}

// ToggleExtension, UpdateIni, RestartFPM
// InstallVersion installs a PHP version directly
func (r *PHPController) InstallVersion(ctx http.Context) http.Response {
	version := ctx.Request().Input("version")
	if err := r.phpService.InstallVersion(version); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}
	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("PHP %s installed successfully", version),
	})
}

func (r *PHPController) ToggleExtension(ctx http.Context) http.Response {
	version := ctx.Request().Input("version")
	extension := ctx.Request().Input("extension")
	enable := ctx.Request().InputBool("enable", true)

	if err := r.phpService.ToggleExtension(version, extension, enable); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Extension '%s' updated for PHP %s", extension, version),
	})
}

func (r *PHPController) UpdateIni(ctx http.Context) http.Response {
	version := ctx.Request().Input("version")
	memoryLimit := ctx.Request().Input("memory_limit")
	uploadMax := ctx.Request().Input("upload_max_filesize")
	postMax := ctx.Request().Input("post_max_size")
	maxExecTime := ctx.Request().Input("max_execution_time")
	maxInputVars := ctx.Request().Input("max_input_vars")

	if err := r.phpService.UpdateIniSettings(version, memoryLimit, uploadMax, postMax, maxExecTime, maxInputVars); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("php.ini for PHP %s updated and FPM reloaded successfully", version),
	})
}

func (r *PHPController) RestartFPM(ctx http.Context) http.Response {
	version := ctx.Request().Input("version")
	if err := r.phpService.RestartFPM(version); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("PHP %s FPM service restarted successfully", version),
	})
}

// SetDefaultCLI sets the system-wide default PHP CLI binary via update-alternatives.
func (r *PHPController) SetDefaultCLI(ctx http.Context) http.Response {
	version := ctx.Request().Input("version")
	if version == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "version is required",
		})
	}

	if err := r.phpService.SetDefaultCLI(version); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("System default PHP CLI set to %s", version),
		"cli":     r.phpService.GetCLIOverview(),
	})
}
