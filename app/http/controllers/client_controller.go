package controllers

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"

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
	return ""
}

func (c *ClientController) requireUsername(ctx http.Context) (string, http.Response) {
	username := c.getUsername(ctx)
	if username == "" {
		return "", ctx.Response().Status(401).Json(http.Json{
			"status":  false,
			"message": "Unauthorized: client session required.",
		})
	}
	return username, nil
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

	limiter := services.GetLoginLimiter()
	ip := requestIP(ctx)
	if ok, wait := limiter.Allowed("client", ip, req.Username); !ok {
		return tooManyAttempts(ctx, wait)
	}

	var authenticatedUser *services.UserAccount
	role := "client"

	users := c.userService.ListUsers()
	for _, u := range users {
		if strings.EqualFold(u.Username, req.Username) && services.IsValidAccountUsername(u.Username) {
			valid := false

			// 1. Try modern bcrypt check
			if facades.Hash() != nil && u.PasswordHash != "" {
				valid = facades.Hash().Check(req.Password, u.PasswordHash)
			}

			// 2. Fallback to legacy SHA256 check and re-hash to bcrypt on success
			if !valid && u.PasswordHash != "" {
				legacyHash := sha256.Sum256([]byte(req.Password))
				legacyHashStr := hex.EncodeToString(legacyHash[:])
				if subtle.ConstantTimeCompare([]byte(legacyHashStr), []byte(u.PasswordHash)) == 1 {
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
		limiter.Fail("client", ip, req.Username)
		return ctx.Response().Status(401).Json(http.Json{
			"status":  false,
			"message": "Invalid client credentials. Please verify username and password.",
		})
	}
	limiter.Success("client", ip, req.Username)

	tokenString, err := services.NewAuthService().IssueToken(authenticatedUser.Username, role, services.TokenScopeClient, services.ClientTokenTTL)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  false,
			"message": "Failed to generate security token.",
		})
	}
	setSessionCookie(ctx, "ak_client_token", tokenString, services.ClientTokenTTL)

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

// POST /api/client/auth/logout
func (c *ClientController) Logout(ctx http.Context) http.Response {
	token := ctx.Request().Cookie("ak_client_token")
	if h := ctx.Request().Header("Authorization", ""); strings.HasPrefix(h, "Bearer ") {
		token = strings.TrimPrefix(h, "Bearer ")
	}
	if token != "" {
		services.NewAuthService().Revoke(token)
	}
	setSessionCookie(ctx, "ak_client_token", "", 0)
	return ctx.Response().Success().Json(http.Json{"status": true, "message": "Logged out"})
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

// POST /api/client/websites/docroot
func (c *ClientController) UpdateWebsiteDocroot(ctx http.Context) http.Response {
	username, errResp := c.requireUsername(ctx)
	if errResp != nil {
		return errResp
	}

	var req struct {
		Domain       string `json:"domain"`
		DocumentRoot string `json:"document_root"`
	}
	if err := ctx.Request().Bind(&req); err != nil || req.Domain == "" || req.DocumentRoot == "" {
		return ctx.Response().Status(400).Json(http.Json{
			"status":  false,
			"message": "Domain and document_root are required.",
		})
	}

	if err := c.clientService.SetWebsiteDocroot(username, req.Domain, req.DocumentRoot); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "Document root updated successfully.",
	})
}

// POST /api/client/websites/delete
func (c *ClientController) DeleteWebsite(ctx http.Context) http.Response {
	username, errResp := c.requireUsername(ctx)
	if errResp != nil {
		return errResp
	}
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
	username, errResp := c.requireUsername(ctx)
	if errResp != nil {
		return errResp
	}
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
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": err.Error()})
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
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "DNS record deleted successfully!",
	})
}

// POST /api/client/dns/record/update
func (c *ClientController) UpdateDNSRecord(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Domain   string `json:"domain"`
		Index    int    `json:"index"`
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
	if err := c.clientService.UpdateDNSRecord(username, req.Domain, req.Index, req.Name, req.Type, req.Value, req.TTL, req.Priority); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "DNS record updated successfully!",
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
// FTP ACCOUNTS HANDLERS
// =========================================================================

// GET /api/client/ftp
func (c *ClientController) FTPUsers(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	result, err := c.clientService.ListFTPUsers(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{
		"status":    true,
		"data":      result.Users,
		"ftp_users": result.Users,
		"server":    result.Server,
	})
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

// POST /api/client/php/config
func (c *ClientController) SavePHPConfig(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	if username == "" {
		return ctx.Response().Status(401).Json(http.Json{"status": false, "message": "Unauthorized."})
	}

	var req struct {
		MemoryLimit string `json:"memory_limit"`
		UploadMax   string `json:"upload_max_filesize"`
		Version     string `json:"version"`
		MaxExec     int    `json:"max_execution_time"`
	}
	_ = ctx.Request().Bind(&req)
	if req.MemoryLimit == "" {
		req.MemoryLimit = strings.TrimSpace(ctx.Request().Input("memory_limit"))
	}
	if req.UploadMax == "" {
		req.UploadMax = strings.TrimSpace(ctx.Request().Input("upload_max_filesize"))
	}
	if req.Version == "" {
		req.Version = strings.TrimSpace(ctx.Request().Input("version"))
	}
	if req.MaxExec == 0 {
		req.MaxExec, _ = strconv.Atoi(strings.TrimSpace(ctx.Request().Input("max_execution_time")))
	}

	memMB := services.ParsePHPMemoryMB(req.MemoryLimit)
	uploadMB := services.ParsePHPMemoryMB(req.UploadMax)

	if err := c.clientService.SavePHPConfig(username, req.Version, memMB, uploadMB, req.MaxExec); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	cfg, _ := c.clientService.GetPHPConfig(username)
	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": "PHP configuration saved. memory_limit cannot exceed the package RAM cap.",
		"data":    cfg,
	})
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
		Email     string `json:"email"`
		EmailUser string `json:"email_user"`
		Domain    string `json:"domain"`
		Password  string `json:"password"`
		QuotaMB   int    `json:"quota_mb"`
	}
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Invalid request payload."})
	}
	if req.Email == "" && req.EmailUser != "" && req.Domain != "" {
		req.Email = strings.TrimSpace(req.EmailUser) + "@" + strings.TrimSpace(req.Domain)
	}
	if req.Email == "" || req.Password == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Email address and password are required."})
	}

	if req.QuotaMB <= 0 {
		req.QuotaMB = 1024
	}

	if err := c.clientService.CreateEmail(username, req.Email, req.Password, req.QuotaMB); err != nil {
		if errors.Is(err, services.ErrMailboxExists) {
			return ctx.Response().Status(409).Json(http.Json{"status": false, "message": err.Error()})
		}
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  true,
		"message": fmt.Sprintf("Mailbox '%s' created successfully!", req.Email),
	})
}

func (c *ClientController) DestroyEmail(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	email := ctx.Request().Query("email", "")
	if email == "" {
		email = ctx.Request().Input("email")
	}
	if email == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Email address is required."})
	}
	if err := c.clientService.DeleteEmail(username, email); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "message": "Mailbox deleted."})
}

func (c *ClientController) ChangeEmailPassword(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	var req struct {
		Email       string `json:"email"`
		NewPassword string `json:"new_password"`
	}
	_ = ctx.Request().Bind(&req)
	if req.Email == "" {
		req.Email = ctx.Request().Input("email")
	}
	if req.NewPassword == "" {
		req.NewPassword = ctx.Request().Input("new_password")
	}
	if req.Email == "" || req.NewPassword == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": "Email and new_password are required."})
	}
	if err := c.clientService.ChangeEmailPassword(username, req.Email, req.NewPassword); err != nil {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "message": "Mailbox password updated."})
}

func (c *ClientController) WebmailSSO(ctx http.Context) http.Response {
	username := c.getUsername(ctx)
	email := ctx.Request().Query("email", "")
	if email == "" {
		email = ctx.Request().Input("email")
	}
	owned, err := c.clientService.GetEmails(username)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": false, "message": err.Error()})
	}
	ok := false
	for _, e := range owned {
		if e.Email == email {
			ok = true
			break
		}
	}
	if !ok {
		return ctx.Response().Status(403).Json(http.Json{"status": false, "message": "Mailbox not found on this account."})
	}
	token, err := services.NewEmailService().IssueWebmailSSOToken(email)
	if err != nil {
		return ctx.Response().Status(400).Json(http.Json{"status": false, "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": true, "url": "/webmail/sso?token=" + token})
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
