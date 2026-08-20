package models

import (
	"github.com/goravel/framework/database/orm"
)

type User struct {
	orm.Model
	Username         string `gorm:"column:username;unique;not null" json:"username"`
	PasswordHash     string `gorm:"column:password_hash;not null" json:"-"`
	Email            string `gorm:"column:email" json:"email"`
	MainDomain       string `gorm:"column:main_domain" json:"main_domain"`
	PackageID        string `gorm:"column:package_id" json:"package_id"`
	PackageName      string `gorm:"column:package_name" json:"package_name"`
	HomeDir          string `gorm:"column:home_dir" json:"home_dir"`
	Status           string `gorm:"column:status;default:'active'" json:"status"` // active, suspended
	SuspendedReason  string `gorm:"column:suspended_reason" json:"suspended_reason"`
	IsReseller       bool   `gorm:"column:is_reseller;default:false" json:"is_reseller"`
	ShellAccess      bool   `gorm:"column:shell_access;default:false" json:"shell_access"`
	Language         string `gorm:"column:language;default:'en'" json:"language"`
	IPAddress        string `gorm:"column:ip_address" json:"ip_address"`
	DiskQuotaMB      int    `gorm:"column:disk_quota_mb;default:0" json:"disk_quota_mb"`
	BandwidthLimitMB int    `gorm:"column:bandwidth_limit_mb;default:0" json:"bandwidth_limit_mb"`
	InodesLimit      int    `gorm:"column:inodes_limit;default:0" json:"inodes_limit"`
	RAMLimitMB       int    `gorm:"column:ram_limit_mb;default:0" json:"ram_limit_mb"`
	MaxProcesses     int    `gorm:"column:max_processes;default:40" json:"max_processes"`
}
