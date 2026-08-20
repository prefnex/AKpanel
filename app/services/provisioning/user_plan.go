package provisioning

import (
	"goravel/app/services"
)

// UserProvisionPlan holds parameters for the full user provisioning pipeline.
type UserProvisionPlan struct {
	Username       string `json:"username"`
	Password       string `json:"password"`
	Email          string `json:"email"`
	MainDomain     string `json:"main_domain"`
	PackageID      string `json:"package_id"`
	ServerIP       string `json:"server_ip"`
	Language       string `json:"language"`
	ShellAccess    bool   `json:"shell_access"`
	IsReseller     bool   `json:"is_reseller"`
	AutoSSL        bool   `json:"autossl"`
	BackupEnabled  bool   `json:"backup_enabled"`
	CreateMySQL    bool   `json:"create_mysql"`
	ProcessLimit   int    `json:"process_limit"`
	OpenFilesLimit int    `json:"open_files_limit"`
	InodeLimit     int    `json:"inode_limit"`

	// Resolved at runtime
	HomeDir    string `json:"home_dir"`
	RootPath   string `json:"root_path"`
	PHPVersion string `json:"php_version"`
	WebEngine  string `json:"web_engine"`
	TaskID     string `json:"task_id"`

	// Package snapshot
	PackageName string `json:"package_name"`

	// Result
	ResultUser *services.UserAccount `json:"result_user,omitempty"`
}
