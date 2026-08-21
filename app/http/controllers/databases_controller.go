package controllers

import (
	"github.com/goravel/framework/contracts/http"
	"goravel/app/services"
)

type DatabasesController struct {
	dbService *services.DatabaseService
}

func NewDatabasesController() *DatabasesController {
	return &DatabasesController{
		dbService: services.NewDatabaseService(),
	}
}

// Index returns list of user databases and engine status
func (r *DatabasesController) Index(ctx http.Context) http.Response {
	engineFilter := ctx.Request().Input("engine", "all")
	dbs, err := r.dbService.ListDatabases(engineFilter)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	engines := r.dbService.GetEnginesOverview()

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"data":    dbs,
		"engines": engines,
	})
}

// Store creates a new database and user for specified engine
func (r *DatabasesController) Store(ctx http.Context) http.Response {
	name := ctx.Request().Input("name")
	engine := ctx.Request().Input("engine", "mysql")
	collation := ctx.Request().Input("collation", "")
	user := ctx.Request().Input("username")
	pass := ctx.Request().Input("password")

	if name == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Database name is required",
		})
	}

	if err := r.dbService.CreateDatabase(name, engine, collation, user, pass); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Database '" + name + "' (" + engine + ") created successfully",
	})
}

// Destroy drops a database
func (r *DatabasesController) Destroy(ctx http.Context) http.Response {
	id := ctx.Request().Input("id")
	if id == "" {
		id = ctx.Request().Input("name")
	}

	if id == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Database ID is required",
		})
	}

	if err := r.dbService.DeleteDatabase(id); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Database dropped successfully",
	})
}

// Query executes a query on database
func (r *DatabasesController) Query(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine", "mysql")
	dbName := ctx.Request().Input("database", "akpanel_main")
	query := ctx.Request().Input("query", "")

	result, err := r.dbService.ExecuteQuery(engine, dbName, query)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   result,
	})
}

// EngineControl controls service (start/stop/restart)
func (r *DatabasesController) EngineControl(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine")
	action := ctx.Request().Input("action", "restart")

	if engine == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Engine is required",
		})
	}

	if err := r.dbService.ControlEngine(engine, action); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Engine '" + engine + "' " + action + " executed successfully",
	})
}

// StartLiveInstall starts a background installation task
func (r *DatabasesController) StartLiveInstall(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine")
	if engine == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Engine name is required",
		})
	}

	taskID, err := r.dbService.StartLiveInstall(engine)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"task_id": taskID,
		"message": "Installation of " + engine + " started",
	})
}

// GetTaskStatus returns progress and logs of live install
func (r *DatabasesController) GetTaskStatus(ctx http.Context) http.Response {
	taskID := ctx.Request().Input("task_id")
	if taskID == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Task ID is required",
		})
	}

	task, err := r.dbService.GetTaskStatus(taskID)
	if err != nil {
		return ctx.Response().Status(404).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   task,
	})
}

// GetConfig returns configuration file content
func (r *DatabasesController) GetConfig(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine", "mysql")
	path, content, err := r.dbService.GetEngineConfig(engine)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"path":    path,
		"content": content,
	})
}

// SaveConfig saves configuration file and restarts service
func (r *DatabasesController) SaveConfig(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine", "mysql")
	content := ctx.Request().Input("content", "")

	if err := r.dbService.SaveEngineConfig(engine, content); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Configuration saved and " + engine + " restarted successfully",
	})
}

// GetLogs returns service error logs
func (r *DatabasesController) GetLogs(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine", "mysql")
	logs := r.dbService.GetEngineLogs(engine)

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"logs":   logs,
	})
}

// ListUsers returns database users
func (r *DatabasesController) ListUsers(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine", "mysql")
	users, err := r.dbService.ListUsers(engine)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   users,
	})
}

// CreateUser adds a new user with password
func (r *DatabasesController) CreateUser(ctx http.Context) http.Response {
	username := ctx.Request().Input("username")
	engine := ctx.Request().Input("engine", "mysql")
	host := ctx.Request().Input("host", "localhost")
	password := ctx.Request().Input("password")
	privilege := ctx.Request().Input("privilege", "ALL PRIVILEGES")
	dbName := ctx.Request().Input("database", "")

	if username == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Username is required",
		})
	}

	if err := r.dbService.CreateUser(username, engine, host, password, privilege, dbName); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Database user '" + username + "' created and granted privileges",
	})
}

// DeleteUser drops a database user
func (r *DatabasesController) DeleteUser(ctx http.Context) http.Response {
	username := ctx.Request().Input("username")
	engine := ctx.Request().Input("engine", "mysql")
	host := ctx.Request().Input("host", "localhost")

	if username == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Username is required",
		})
	}

	if err := r.dbService.DeleteUser(username, engine, host); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Database user dropped successfully",
	})
}

// FlushRedis flushes Redis in-memory cache
func (r *DatabasesController) FlushRedis(ctx http.Context) http.Response {
	if err := r.dbService.FlushRedis(); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Redis in-memory cache flushed successfully",
	})
}

// GetVersions returns available and active versions for the selected engine
func (r *DatabasesController) GetVersions(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine", "mysql")
	versions := r.dbService.GetAvailableVersions(engine)

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   versions,
	})
}

// SwitchVersion initiates live switching / upgrading of an engine version
func (r *DatabasesController) SwitchVersion(ctx http.Context) http.Response {
	engine := ctx.Request().Input("engine", "mysql")
	version := ctx.Request().Input("version", "")

	if version == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "Target version is required",
		})
	}

	taskID, err := r.dbService.SwitchEngineVersion(engine, version)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Version switch task started for " + engine + " version " + version,
		"task_id": taskID,
	})
}

// GetPhpMyAdminConfig returns PMA configuration
func (r *DatabasesController) GetPhpMyAdminConfig(ctx http.Context) http.Response {
	cfg := r.dbService.GetPhpMyAdminConfig()
	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   cfg,
	})
}

// SavePhpMyAdminConfig updates PMA configuration
func (r *DatabasesController) SavePhpMyAdminConfig(ctx http.Context) http.Response {
	autoLogin := ctx.Request().InputBool("auto_login", true)
	maxUpload := ctx.Request().InputInt("upload_max_mb", 128)
	timeout := ctx.Request().InputInt("session_timeout_min", 1440)

	if err := r.dbService.SavePhpMyAdminConfig(autoLogin, maxUpload, timeout); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "phpMyAdmin settings saved and daemon restarted successfully",
	})
}

// GetPhpMyAdminSSO creates a 1-click SSO session for Root WHM admin
func (r *DatabasesController) GetPhpMyAdminSSO(ctx http.Context) http.Response {
	ssoURL, err := r.dbService.CreatePmaSsoSession("", "")
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  false,
			"message": err.Error(),
		})
	}
	return ctx.Response().Success().Json(http.Json{
		"status":       true,
		"redirect_url": ssoURL,
		"url":          ssoURL,
	})
}


