package controllers

import (
	goravelhttp "github.com/goravel/framework/contracts/http"

	"goravel/app/services"
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
	Username        string `json:"username"`
	Password        string `json:"password"`
	Email           string `json:"email"`
	MainDomain      string `json:"main_domain"`
	ServerIP        string `json:"server_ip"`
	PackageID       string `json:"package_id"`
	IsReseller      bool   `json:"is_reseller"`
	Language        string `json:"language"`
	InodeLimit      int    `json:"inode_limit"`
	ProcessLimit    int    `json:"process_limit"`
	OpenFilesLimit  int    `json:"open_files_limit"`
	BackupEnabled   bool   `json:"backup_enabled"`
	ShellAccess     bool   `json:"shell_access"`
	AutoSSL         bool   `json:"autossl"`
	CreateMySQL     bool   `json:"create_mysql"`
}

// Index lists all users with live quota telemetry
func (c *UsersController) Index(ctx goravelhttp.Context) goravelhttp.Response {
	list := c.userAccountService.ListUsers()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   list,
	})
}

// Store provisions a new client user
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

	if err := c.userAccountService.CreateUser(
		req.Username, 
		req.Password, 
		req.Email, 
		req.MainDomain, 
		req.PackageID, 
		req.ShellAccess, 
		req.IsReseller, 
		req.AutoSSL, 
		req.BackupEnabled, 
		req.CreateMySQL, 
		req.ProcessLimit, 
		req.OpenFilesLimit, 
		req.InodeLimit, 
		req.Language, 
		req.ServerIP,
	); err != nil {
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
		"message": "Permissions repaired successfully (chown & chmod 755/644)!",
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

