package controllers

import (
	"context"

	goravelhttp "github.com/goravel/framework/contracts/http"

	"goravel/app/services"
	"goravel/app/services/provisioning"
	"goravel/app/services/tasks"
)

type UsersController struct {
	userAccountService *services.UserAccountService
}

func NewUsersController() *UsersController {
	return &UsersController{
		userAccountService: services.NewUserAccountService(),
	}
}

type CreateUserRequest struct {
	Username       string `json:"username"`
	Password       string `json:"password"`
	Email          string `json:"email"`
	MainDomain     string `json:"main_domain"`
	ServerIP       string `json:"server_ip"`
	PackageID      string `json:"package_id"`
	IsReseller     bool   `json:"is_reseller"`
	Language       string `json:"language"`
	InodeLimit     int    `json:"inode_limit"`
	ProcessLimit   int    `json:"process_limit"`
	OpenFilesLimit int    `json:"open_files_limit"`
	BackupEnabled  bool   `json:"backup_enabled"`
	ShellAccess    bool   `json:"shell_access"`
	AutoSSL        bool   `json:"autossl"`
	CreateMySQL    bool   `json:"create_mysql"`
}

func (c *UsersController) buildPlan(req CreateUserRequest) *provisioning.UserProvisionPlan {
	return &provisioning.UserProvisionPlan{
		Username:       req.Username,
		Password:       req.Password,
		Email:          req.Email,
		MainDomain:     req.MainDomain,
		PackageID:      req.PackageID,
		ServerIP:       req.ServerIP,
		Language:       req.Language,
		ShellAccess:    req.ShellAccess,
		IsReseller:     req.IsReseller,
		AutoSSL:        req.AutoSSL,
		BackupEnabled:  req.BackupEnabled,
		CreateMySQL:    req.CreateMySQL,
		ProcessLimit:   req.ProcessLimit,
		OpenFilesLimit: req.OpenFilesLimit,
		InodeLimit:     req.InodeLimit,
	}
}

// Index lists all users with live quota telemetry
func (c *UsersController) Index(ctx goravelhttp.Context) goravelhttp.Response {
	list := c.userAccountService.ListUsers()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   list,
	})
}

// Store provisions a new client user synchronously (legacy compatibility).
func (c *UsersController) Store(ctx goravelhttp.Context) goravelhttp.Response {
	var req CreateUserRequest
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid request payload: " + err.Error(),
		})
	}

	if req.Username == "" || req.Password == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Username and password are required",
		})
	}

	if err := provisioning.GetUserOrchestrator().ProvisionUser(context.Background(), c.buildPlan(req)); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "User account, Linux permissions, and vhost provisioned successfully!",
	})
}

// Provision starts async user provisioning and returns a task_id immediately.
func (c *UsersController) Provision(ctx goravelhttp.Context) goravelhttp.Response {
	var req CreateUserRequest
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid request payload: " + err.Error(),
		})
	}

	if req.Username == "" || req.Password == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Username and password are required",
		})
	}

	taskID, err := provisioning.GetUserOrchestrator().StartAsyncProvision(c.buildPlan(req))
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"task_id": taskID,
		"message": "User provisioning started",
	})
}

// ProvisionStatus returns progress for an async user provisioning task.
func (c *UsersController) ProvisionStatus(ctx goravelhttp.Context) goravelhttp.Response {
	taskID := ctx.Request().Input("task_id")
	if taskID == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "task_id is required",
		})
	}

	task, err := tasks.GetRegistry().Get(taskID)
	if err != nil {
		return ctx.Response().Status(404).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Task not found",
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   task,
	})
}

// ActiveTasks lists running provisioning tasks (for browser refresh recovery).
func (c *UsersController) ActiveTasks(ctx goravelhttp.Context) goravelhttp.Response {
	kind := ctx.Request().Input("kind", "user_provision")
	list, err := tasks.GetRegistry().ListActive(kind)
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   list,
	})
}

// FixPermissions fixes file ownership and permissions for a user
func (c *UsersController) FixPermissions(ctx goravelhttp.Context) goravelhttp.Response {
	username := ctx.Request().Input("username")
	if username == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Username is required",
		})
	}

	if err := c.userAccountService.FixPermissions(username); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Permissions repaired successfully (user:user ownership, 711/755)!",
	})
}

// ChangePackage updates package assignment
func (c *UsersController) ChangePackage(ctx goravelhttp.Context) goravelhttp.Response {
	username := ctx.Request().Input("username")
	packageID := ctx.Request().Input("package_id")

	if username == "" || packageID == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Username and Package ID are required",
		})
	}

	if err := c.userAccountService.ChangePackage(username, packageID); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "User package upgraded/updated successfully!",
	})
}

// Suspend suspends a client user
func (c *UsersController) Suspend(ctx goravelhttp.Context) goravelhttp.Response {
	username := ctx.Request().Input("username")
	reason := ctx.Request().Input("reason", "Administrative suspension")

	if username == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Username is required",
		})
	}

	if err := c.userAccountService.SuspendUser(username, reason); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "User account suspended successfully!",
	})
}

// Unsuspend unsuspends a client user
func (c *UsersController) Unsuspend(ctx goravelhttp.Context) goravelhttp.Response {
	username := ctx.Request().Input("username")
	if username == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Username is required",
		})
	}

	if err := c.userAccountService.UnsuspendUser(username); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "User account unsuspended successfully!",
	})
}

// ResetPassword updates a user's Linux system password
func (c *UsersController) ResetPassword(ctx goravelhttp.Context) goravelhttp.Response {
	username := ctx.Request().Input("username")
	newPassword := ctx.Request().Input("password")

	if username == "" || newPassword == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Username and new password are required",
		})
	}

	if err := c.userAccountService.ResetPassword(username, newPassword); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "User password reset successfully!",
	})
}

// Update modifies user account settings, packages, quotas, IP, and shell access
func (c *UsersController) Update(ctx goravelhttp.Context) goravelhttp.Response {
	username := ctx.Request().Input("username")
	if username == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Username is required",
		})
	}

	var req services.UserUpdateRequest
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid update payload: " + err.Error(),
		})
	}

	updatedUser, err := c.userAccountService.UpdateUser(username, req)
	if err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "User account updated successfully!",
		"data":    updatedUser,
	})
}

// Destroy removes a user account
func (c *UsersController) Destroy(ctx goravelhttp.Context) goravelhttp.Response {
	username := ctx.Request().Input("username")
	if username == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Username is required",
		})
	}

	if err := c.userAccountService.DeleteUser(username); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "User account and home directory deleted successfully!",
	})
}
