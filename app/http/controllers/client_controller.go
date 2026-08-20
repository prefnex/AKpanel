package controllers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/goravel/framework/contracts/http"

	"goravel/app/facades"
	"goravel/app/services"
)

type ClientController struct {
	clientService *services.ClientService
	userService   *services.UserAccountService
}

func NewClientController() *ClientController {
	return &ClientController{
		clientService: services.GetClientService(),
		userService:   services.NewUserAccountService(),
	}
}

func (c *ClientController) getUsername(ctx http.Context) string {
	val := ctx.Value("client_username")
	if val != nil {
		if s, ok := val.(string); ok && s != "" {
			return s
		}
	}
	return "root"
}

// POST /api/client/auth/login
func (c *ClientController) Login(ctx http.Context) http.Response {
	var req struct {
		Username string `json:"username" form:"username"`
		Password string `json:"password" form:"password"`
	}

	if err := ctx.Request().Bind(&req); err != nil || req.Username == "" || req.Password == "" {
		return ctx.Response().Status(400).Json(http.Json{
			"status":  false,
			"message": "Username and password are required.",
		})
	}

	var authenticatedUser *services.UserAccount
	role := "client"

	users := c.userService.ListUsers()
	for _, u := range users {
		if strings.EqualFold(u.Username, req.Username) {
			valid := false

			// 1. Try modern bcrypt check
			if facades.Hash() != nil && u.PasswordHash != "" {
				valid = facades.Hash().Check(req.Password, u.PasswordHash)
			}

			// 2. Fallback to legacy SHA256 check and re-hash to bcrypt on success
			if !valid && u.PasswordHash != "" {
				legacyHash := sha256.Sum256([]byte(req.Password))
				legacyHashStr := hex.EncodeToString(legacyHash[:])
				if legacyHashStr == u.PasswordHash {
					valid = true
					// Seamless migration: upgrade legacy hash to bcrypt
					if facades.Hash() != nil {
						if newBcryptHash, err := facades.Hash().Make(req.Password); err == nil {
							u.PasswordHash = newBcryptHash
							_ = c.userService.SaveUser(u)
						}
					}
				}
			}

			if valid {
				if u.Status == "suspended" {
					return ctx.Response().Status(403).Json(http.Json{
						"status":  false,
						"message": "This hosting account is suspended: " + u.SuspendedReason,
					})
				}
				userCopy := u
				authenticatedUser = &userCopy
				break
			}
		}
	}

	if authenticatedUser == nil {
		return ctx.Response().Status(401).Json(http.Json{
			"status":  false,
			"message": "Invalid client credentials. Please verify username and password.",
		})
	}

	secret := facades.Config().GetString("app.key", "AKpanel-SuperSecretKey-2026-ChangeInProduction!")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":      authenticatedUser.Username,
		"username": authenticatedUser.Username,
		"role":     role,
		"iss":      "AKpanel-Client-Portal",
		"iat":      time.Now().Unix(),
		"exp":      time.Now().Add(time.Hour * 72).Unix(),
	})

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  false,
			"message": "Failed to generate security token.",
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "Welcome to your Hosting Control Panel",
		"token":   tokenString,
		"user": map[string]any{
			"username":    authenticatedUser.Username,
			"email":       authenticatedUser.Email,
			"main_domain": authenticatedUser.MainDomain,
			"package":     authenticatedUser.PackageName,
			"role":        role,
		},
	})
}

// GET /api/client/auth/me
func (c *ClientController) Me(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	stats, err := c.clientService.GetDashboardStats(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "data": stats})
}

// GET /api/client/stats
func (c *ClientController) Stats(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	stats, err := c.clientService.GetDashboardStats(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "data": stats})
}

// GET /api/client/websites
func (c *ClientController) Websites(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	sites, err := c.clientService.GetWebsites(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "data": sites})
}

// POST /api/client/websites
func (c *ClientController) StoreWebsite(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Domain     string `json:"domain"`
		PHPVersion string `json:"php_version"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Domain name is required."})
	}

	if err := c.clientService.CreateWebsite(username, req.Domain, req.PHPVersion); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": fmt.Sprintf("Domain '%s' provisioned successfully!", req.Domain),
	})
}

// POST /api/client/websites/delete
func (c *ClientController) DeleteWebsite(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Domain string `json:"domain"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Domain is required."})
	}

	if err := c.clientService.DeleteWebsite(username, req.Domain); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": fmt.Sprintf("Domain '%s' removed.", req.Domain),
	})
}

// GET /api/client/dns/zones
func (c *ClientController) DNSZones(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	zones, err := c.clientService.GetDNSZones(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "data": zones, "zones": zones})
}

// POST /api/client/dns/record
func (c *ClientController) StoreDNSRecord(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Domain   string `json:"domain"`
		Name     string `json:"name"`
		Type     string `json:"type"`
		Value    string `json:"value"`
		TTL      int    `json:"ttl"`
		Priority int    `json:"priority"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" || req.Value == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Domain, name, and value are required."})
	}

	if req.TTL <= 0 {
		req.TTL = 3600
	}

	if err := c.clientService.AddDNSRecord(username, req.Domain, req.Name, req.Type, req.Value, req.TTL, req.Priority); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "DNS record added successfully!",
	})
}

// POST /api/client/dns/record/delete
func (c *ClientController) DeleteDNSRecord(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Domain string `json:"domain"`
		Index  int    `json:"index"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Domain is required."})
	}

	if err := c.clientService.DeleteDNSRecord(username, req.Domain, req.Index); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "DNS record deleted successfully!",
	})
}

// GET /api/client/databases
func (c *ClientController) Databases(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	dbs, err := c.clientService.GetDatabases(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "data": dbs, "databases": dbs})
}

// POST /api/client/databases
func (c *ClientController) StoreDatabase(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		DatabaseName string `json:"database_name"`
		DatabaseUser string `json:"database_user"`
		Password     string `json:"password"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.DatabaseName == "" || req.Password == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Database name and password are required."})
	}

	if err := c.clientService.CreateDatabase(username, req.DatabaseName, req.DatabaseUser, req.Password); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": fmt.Sprintf("Database '%s_%s' provisioned successfully!", username, req.DatabaseName),
	})
}

// POST /api/client/databases/delete
func (c *ClientController) DeleteDatabase(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		DatabaseName string `json:"database_name"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.DatabaseName == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Database name is required."})
	}

	if err := c.clientService.DeleteDatabase(username, req.DatabaseName); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": fmt.Sprintf("Database '%s' dropped.", req.DatabaseName),
	})
}

// =========================================================================
// JAILED FILE MANAGER V2 HANDLERS
// =========================================================================

// GET /api/client/files
func (c *ClientController) Files(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	path := ctx.Request().Query("path", "/")
	files, err := c.clientService.GetClientFiles(username, path)
	if err != nil {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{
		"status":       true,
		"data":         files,
		"files":        files,
		"current_path": path,
	})
}

// GET /api/client/files/read
func (c *ClientController) ReadFile(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	path := ctx.Request().Query("path", "")
	if path == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "File path is required."})
	}

	content, err := c.clientService.ReadClientFile(username, path)
	if err != nil {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"content": content,
		"path":    path,
	})
}

// POST /api/client/files/save
func (c *ClientController) SaveFile(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Path == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Path and content are required."})
	}

	if err := c.clientService.SaveClientFile(username, req.Path, req.Content); err != nil {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "File saved successfully!",
	})
}

// POST /api/client/files/create
func (c *ClientController) CreateFile(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Name == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "File name is required."})
	}

	if err := c.clientService.CreateClientFile(username, req.Path, req.Name); err != nil {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": fmt.Sprintf("File '%s' created.", req.Name),
	})
}

// POST /api/client/files/mkdir
func (c *ClientController) CreateFolder(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Name == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Folder name is required."})
	}

	if err := c.clientService.CreateClientFolder(username, req.Path, req.Name); err != nil {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": fmt.Sprintf("Folder '%s' created.", req.Name),
	})
}

// POST /api/client/files/delete
func (c *ClientController) DeleteFile(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Path string `json:"path"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Path == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Path is required."})
	}

	if err := c.clientService.DeleteClientFile(username, req.Path); err != nil {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "Item deleted.",
	})
}

// POST /api/client/files/rename
func (c *ClientController) RenameFile(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		OldPath string `json:"old_path"`
		NewName string `json:"new_name"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.OldPath == "" || req.NewName == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Old path and new name are required."})
	}

	if err := c.clientService.RenameClientFile(username, req.OldPath, req.NewName); err != nil {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "Item renamed.",
	})
}

// POST /api/client/files/chmod
func (c *ClientController) ChmodFile(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Path string `json:"path"`
		Mode string `json:"mode"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Path == "" || req.Mode == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Path and mode are required."})
	}

	if err := c.clientService.ChmodClientFile(username, req.Path, req.Mode); err != nil {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "Permissions updated.",
	})
}

// POST /api/client/files/extract
func (c *ClientController) ExtractArchive(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		ArchivePath string `json:"archive_path"`
		DestPath    string `json:"dest_path"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.ArchivePath == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Archive path is required."})
	}

	if req.DestPath == "" {
		req.DestPath = "/"
	}

	if err := c.clientService.ExtractClientArchive(username, req.ArchivePath, req.DestPath); err != nil {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "Archive extracted successfully.",
	})
}

// POST /api/client/files/compress
func (c *ClientController) CompressArchive(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		TargetDir   string   `json:"target_dir"`
		ArchiveName string   `json:"archive_name"`
		Files       []string `json:"files"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.ArchiveName == "" || len(req.Files) == 0 {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Archive name and files are required."})
	}

	if err := c.clientService.CompressClientArchive(username, req.TargetDir, req.ArchiveName, req.Files); err != nil {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": fmt.Sprintf("Compressed into '%s'.", req.ArchiveName),
	})
}

// GET /api/client/files/search
func (c *ClientController) SearchFiles(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	query := ctx.Request().Query("q", "")
	if query == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Query string is required."})
	}

	matches, err := c.clientService.SearchClientFiles(username, query)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"data":    matches,
		"matches": matches,
	})
}

// POST /api/client/files/git-clone
func (c *ClientController) GitClone(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		DestPath string `json:"dest_path"`
		RepoURL  string `json:"repo_url"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.RepoURL == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Git repository URL is required."})
	}

	if err := c.clientService.GitCloneClientRepo(username, req.DestPath, req.RepoURL); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "Repository cloned successfully!",
	})
}

// =========================================================================
// FTP ACCOUNTS HANDLERS
// =========================================================================

// GET /api/client/ftp
func (c *ClientController) FTPUsers(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	users, err := c.clientService.ListFTPUsers(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "data": users, "ftp_users": users})
}

// POST /api/client/ftp/create
func (c *ClientController) StoreFTPUser(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		FTPUser  string `json:"ftp_user"`
		Password string `json:"password"`
		SubDir   string `json:"sub_dir"`
		QuotaMB  int    `json:"quota_mb"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.FTPUser == "" || req.Password == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "FTP username and password are required."})
	}

	if err := c.clientService.CreateFTPUser(username, req.FTPUser, req.Password, req.SubDir, req.QuotaMB); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": fmt.Sprintf("FTP Account '%s_%s' created successfully!", username, req.FTPUser),
	})
}

// POST /api/client/ftp/delete
func (c *ClientController) DeleteFTPUser(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		FTPUser string `json:"ftp_user"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.FTPUser == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "FTP user is required."})
	}

	if err := c.clientService.DeleteFTPUser(username, req.FTPUser); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "FTP Account deleted.",
	})
}

// =========================================================================
// CRON JOBS HANDLERS
// =========================================================================

// GET /api/client/cron
func (c *ClientController) CronJobs(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	jobs, err := c.clientService.ListCronJobs(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "data": jobs, "cron_jobs": jobs})
}

// POST /api/client/cron/create
func (c *ClientController) StoreCronJob(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Schedule    string `json:"schedule"`
		Command     string `json:"command"`
		Description string `json:"description"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Schedule == "" || req.Command == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Schedule and command are required."})
	}

	if err := c.clientService.CreateCronJob(username, req.Schedule, req.Command, req.Description); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "Cron job created successfully!",
	})
}

// POST /api/client/cron/delete
func (c *ClientController) DeleteCronJob(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		ID string `json:"id"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.ID == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Cron job ID is required."})
	}

	if err := c.clientService.DeleteCronJob(username, req.ID); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "Cron job deleted.",
	})
}

// POST /api/client/cron/toggle
func (c *ClientController) ToggleCronJob(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		ID string `json:"id"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.ID == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Cron job ID is required."})
	}

	if err := c.clientService.ToggleCronJob(username, req.ID); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "Cron job toggled.",
	})
}

// =========================================================================
// PHP RUNTIME & PHPMYADMIN SSO
// =========================================================================

// GET /api/client/php/config
func (c *ClientController) PHPConfig(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	cfg, err := c.clientService.GetPHPConfig(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "data": cfg})
}

// GET /api/client/phpmyadmin/sso
func (c *ClientController) PhpMyAdminSSO(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	sso, err := c.clientService.GetPhpMyAdminSSO(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{
		"status": true,
		"data":   sso,
	})
}

// =========================================================================
// EMAILS & BACKUPS
// =========================================================================

// GET /api/client/emails
func (c *ClientController) Emails(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	emails, err := c.clientService.GetEmails(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "data": emails, "emails": emails})
}

// POST /api/client/emails
func (c *ClientController) StoreEmail(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		QuotaMB  int    `json:"quota_mb"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Email == "" || req.Password == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Email address and password are required."})
	}

	if req.QuotaMB <= 0 {
		req.QuotaMB = 1024
	}

	if err := c.clientService.CreateEmail(username, req.Email, req.Password, req.QuotaMB); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": fmt.Sprintf("Mailbox '%s' created successfully!", req.Email),
	})
}

// GET /api/client/backups
func (c *ClientController) Backups(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	backups, err := c.clientService.ListBackups(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "data": backups, "backups": backups})
}

// POST /api/client/backups/generate
func (c *ClientController) GenerateBackup(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	archiveName, err := c.clientService.GenerateBackup(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":    true,
		"message":   "Account backup generated successfully!",
		"file_name": archiveName,
	})
}
