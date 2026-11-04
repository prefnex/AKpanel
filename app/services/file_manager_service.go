package services

import (
	"crypto/md5"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"

	"goravel/app/paths"
)

type FileItem struct {
	Name          string    `json:"name"`
	Path          string    `json:"path"`
	IsDir         bool      `json:"is_dir"`
	Size          int64     `json:"size"`
	HumanSize     string    `json:"human_size"`
	Permissions   string    `json:"permissions"`
	OctalPerm     string    `json:"octal_perm"`
	Owner         string    `json:"owner"`
	Group         string    `json:"group"`
	ModTime       time.Time `json:"mod_time"`
	DateFormatted string    `json:"date_formatted"`
	MimeType      string    `json:"mime_type"`
	Extension     string    `json:"extension"`
	IsImage       bool      `json:"is_image"`
	IsArchive     bool      `json:"is_archive"`
	IsCode        bool      `json:"is_code"`
}

type GrepResult struct {
	FilePath   string `json:"file_path"`
	FileName   string `json:"file_name"`
	LineNumber string `json:"line_number"`
	Snippet    string `json:"snippet"`
}

type FileManagerService struct {
	defaultDir string
	jailRoot   string
	tenant     *TenantIdentity
}

func NewFileManagerService() *FileManagerService {
	return &FileManagerService{
		defaultDir: paths.SitesRoot,
	}
}

// WithJail returns a copy confined to a user home (never / or /home).
func (f *FileManagerService) WithJail(root string) *FileManagerService {
	clone := *f
	clone.jailRoot = filepath.Clean(root)
	clone.defaultDir = clone.jailRoot
	return &clone
}

// WithTenant binds the Linux identity every jailed operation runs as.
func (f *FileManagerService) WithTenant(t *TenantIdentity) *FileManagerService {
	clone := *f
	clone.tenant = t
	return &clone
}

func pathInsideRoot(root, target string) bool {
	root = filepath.Clean(root)
	target = filepath.Clean(target)
	if target == root {
		return true
	}
	return strings.HasPrefix(target, root+string(os.PathSeparator))
}

func (f *FileManagerService) resolveManagedPath(targetPath string) (string, error) {
	if f.jailRoot != "" {
		return f.ValidateJailPath(targetPath)
	}
	return f.ValidateAdminPath(targetPath)
}

// jailed reports whether this instance acts for a hosting account.
func (f *FileManagerService) jailed() bool { return f.jailRoot != "" }

// asOwner runs fn with the tenant's filesystem identity when jailed (root otherwise).
// Jailed instances without a resolved tenant refuse to touch the disk at all.
func (f *FileManagerService) asOwner(fn func() error) error {
	if !f.jailed() {
		return fn()
	}
	if f.tenant == nil {
		return fmt.Errorf("access denied: hosting account identity unavailable")
	}
	return f.tenant.Do(fn)
}

// command builds an external command that runs as the tenant when jailed.
func (f *FileManagerService) command(name string, args ...string) *exec.Cmd {
	if f.jailed() && f.tenant != nil {
		return f.tenant.Command(name, args...)
	}
	return exec.Command(name, args...)
}

// runCmd runs a command and folds its output into the error.
func runCmd(cmd *exec.Cmd) error {
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if len(msg) > 400 {
			msg = msg[:400]
		}
		if msg != "" {
			return fmt.Errorf("%s: %w", msg, err)
		}
	}
	return err
}

// fixOwner re-owns a freshly written path. Jailed writes already belong to the tenant,
// and a root chown on a tenant-controlled path could be redirected by a symlink.
func (f *FileManagerService) fixOwner(path string) {
	if f.jailed() {
		return
	}
	chownToParentOrAccount(path)
}

// operand guards a path argument for external tools against being parsed as an option.
func operand(p string) string {
	if strings.HasPrefix(p, "-") {
		return "./" + p
	}
	return p
}

// ValidateJailPath keeps every operation inside jailRoot (no parent of home, no other users).
func (f *FileManagerService) ValidateJailPath(targetPath string) (string, error) {
	jail := filepath.Clean(f.jailRoot)
	if jail == "" || jail == "/" || jail == paths.UserHomes || jail == "/root" {
		return "", fmt.Errorf("access denied: invalid home jail")
	}
	if targetPath == "" || targetPath == "/" {
		targetPath = jail
	}
	clean := filepath.Clean(targetPath)
	if !filepath.IsAbs(clean) {
		clean = filepath.Join(jail, clean)
		clean = filepath.Clean(clean)
	}
	if !pathInsideRoot(jail, clean) {
		return "", fmt.Errorf("access denied: path is outside your home jail")
	}
	if resolved, err := filepath.EvalSymlinks(clean); err == nil {
		jailResolved := jail
		if jr, jerr := filepath.EvalSymlinks(jail); jerr == nil {
			jailResolved = jr
		}
		if !pathInsideRoot(jailResolved, resolved) {
			return "", fmt.Errorf("access denied: path is outside your home jail")
		}
	}
	return clean, nil
}

// ValidateAdminPath verifies that the requested path falls inside allowed server directories
// and prevents path traversal or access to forbidden system sensitive files (TASK-6.02).
func (f *FileManagerService) ValidateAdminPath(targetPath string) (string, error) {
	if targetPath == "" {
		targetPath = f.defaultDir
	}

	cleanPath := filepath.Clean(targetPath)

	// Block sensitive / dangerous system files and directories
	forbiddenPrefixes := []string{
		"/etc/shadow",
		"/etc/gshadow",
		"/root/.ssh",
		"/proc",
		"/sys",
		"/dev",
	}
	for _, forbidden := range forbiddenPrefixes {
		if cleanPath == forbidden || strings.HasPrefix(cleanPath, forbidden+"/") {
			return "", fmt.Errorf("access denied: security policy restricts access to %s", forbidden)
		}
	}

	// Allowed roots for management
	allowedRoots := []string{
		"/var/www",
		"/home",
		"/var/log",
		"/etc/akpanel",
		"/etc/nginx",
		"/etc/apache2",
		"/etc/bind",
		"/tmp",
		"/opt",
	}

	allowed := false
	for _, root := range allowedRoots {
		if cleanPath == root || strings.HasPrefix(cleanPath, root+"/") {
			allowed = true
			break
		}
	}

	if !allowed {
		return "", fmt.Errorf("access denied: path '%s' is outside manageable root directories", cleanPath)
	}

	return cleanPath, nil
}

// ListDirectory lists files and folders with full server inspection
func (f *FileManagerService) ListDirectory(targetPath string) ([]FileItem, string, error) {
	cleanPath, err := f.resolveManagedPath(targetPath)
	if err != nil {
		return nil, targetPath, err
	}

	var entries []os.DirEntry
	var infos []os.FileInfo
	err = f.asOwner(func() error {
		if _, err := os.Stat(cleanPath); os.IsNotExist(err) {
			if cleanPath == f.defaultDir {
				_ = os.MkdirAll(cleanPath, 0755)
			} else {
				return fmt.Errorf("directory '%s' does not exist", cleanPath)
			}
		}
		var err error
		entries, err = os.ReadDir(cleanPath)
		if err != nil {
			return err
		}
		for _, e := range entries {
			info, _ := e.Info()
			infos = append(infos, info)
		}
		return nil
	})
	if err != nil {
		return nil, cleanPath, err
	}

	var items []FileItem
	for i, entry := range entries {
		info := infos[i]
		if info == nil {
			continue
		}

		itemPath := filepath.Join(cleanPath, entry.Name())
		ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(entry.Name()), "."))

		// Resolve owner & group
		ownerName := "root"
		groupName := "root"
		if stat, ok := info.Sys().(*syscall.Stat_t); ok {
			if u, err := user.LookupId(fmt.Sprint(stat.Uid)); err == nil {
				ownerName = u.Username
			}
			if g, err := user.LookupGroupId(fmt.Sprint(stat.Gid)); err == nil {
				groupName = g.Name
			}
		}

		items = append(items, FileItem{
			Name:          entry.Name(),
			Path:          itemPath,
			IsDir:         entry.IsDir(),
			Size:          info.Size(),
			HumanSize:     formatHumanSize(info.Size(), entry.IsDir()),
			Permissions:   info.Mode().String(),
			OctalPerm:     fmt.Sprintf("%04o", info.Mode().Perm()),
			Owner:         ownerName,
			Group:         groupName,
			ModTime:       info.ModTime(),
			DateFormatted: info.ModTime().Format("02/01/06 15:04"),
			MimeType:      detectMimeType(entry.Name(), entry.IsDir(), ext),
			Extension:     ext,
			IsImage:       isImageExtension(ext),
			IsArchive:     isArchiveExtension(ext),
			IsCode:        isCodeExtension(ext),
		})
	}

	return items, cleanPath, nil
}

// maxEditableFileBytes bounds what the code editor loads into memory.
const maxEditableFileBytes = 10 << 20

// ReadFile reads the text content of a file
func (f *FileManagerService) ReadFile(filePath string) (string, error) {
	cleanPath, err := f.resolveManagedPath(filePath)
	if err != nil {
		return "", err
	}
	var data []byte
	err = f.asOwner(func() error {
		info, err := os.Stat(cleanPath)
		if err != nil {
			return err
		}
		if info.Size() > maxEditableFileBytes {
			return fmt.Errorf("file is too large to edit (%s)", formatHumanSize(info.Size(), false))
		}
		data, err = os.ReadFile(cleanPath)
		return err
	})
	return string(data), err
}

// OpenForDownload opens a file for streaming with the caller's (tenant's) permissions.
func (f *FileManagerService) OpenForDownload(filePath string) (*os.File, string, error) {
	cleanPath, err := f.resolveManagedPath(filePath)
	if err != nil {
		return nil, "", err
	}
	var file *os.File
	err = f.asOwner(func() error {
		var err error
		file, err = os.Open(cleanPath)
		if err != nil {
			return err
		}
		if info, err := file.Stat(); err != nil || info.IsDir() {
			file.Close()
			return fmt.Errorf("not a regular file")
		}
		return nil
	})
	return file, cleanPath, err
}

// SaveUpload writes an uploaded stream into destDir/name.
func (f *FileManagerService) SaveUpload(destDir, name string, src io.Reader) (string, error) {
	name = filepath.Base(name)
	if name == "" || name == "." || name == ".." || name == "/" {
		return "", fmt.Errorf("invalid file name")
	}
	cleanDest, err := f.resolveManagedPath(destDir)
	if err != nil {
		return "", err
	}
	target, err := f.resolveManagedPath(filepath.Join(cleanDest, name))
	if err != nil {
		return "", err
	}
	err = f.asOwner(func() error {
		if err := os.MkdirAll(cleanDest, 0755); err != nil {
			return err
		}
		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC|syscall.O_NOFOLLOW, 0644)
		if err != nil {
			return err
		}
		if _, err := io.Copy(out, src); err != nil {
			out.Close()
			return err
		}
		return out.Close()
	})
	if err != nil {
		return "", err
	}
	f.fixOwner(target)
	return target, nil
}

func linuxAccountFromPath(p string) string {
	clean := filepath.Clean(p)
	home := filepath.Clean(paths.UserHomes)
	rel, err := filepath.Rel(home, clean)
	if err != nil || strings.HasPrefix(rel, "..") {
		return ""
	}
	parts := strings.Split(rel, string(os.PathSeparator))
	if len(parts) == 0 || parts[0] == "." || parts[0] == "" {
		return ""
	}
	return parts[0]
}

func chownLike(src, dst string) {
	info, err := os.Stat(src)
	if err != nil {
		info, err = os.Stat(filepath.Dir(src))
		if err != nil {
			return
		}
	}
	st, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return
	}
	_ = os.Lchown(dst, int(st.Uid), int(st.Gid))
	if !info.IsDir() {
		_ = os.Chmod(dst, info.Mode().Perm())
	}
}

func chownToParentOrAccount(path string) {
	if acc := linuxAccountFromPath(path); acc != "" {
		_ = exec.Command("chown", "-h", "--", acc+":"+acc, path).Run()
		return
	}
	chownLike(filepath.Dir(path), path)
}

// WriteFile saves text content and automatically creates a .bak snapshot
func (f *FileManagerService) WriteFile(filePath, content string) error {
	cleanPath, err := f.resolveManagedPath(filePath)
	if err != nil {
		return err
	}

	var uid, gid int = -1, -1
	err = f.asOwner(func() error {
		mode := os.FileMode(0644)
		if info, err := os.Stat(cleanPath); err == nil {
			mode = info.Mode().Perm()
			if st, ok := info.Sys().(*syscall.Stat_t); ok {
				uid, gid = int(st.Uid), int(st.Gid)
			}
			bakPath := fmt.Sprintf("%s.bak", cleanPath)
			if copyErr := copyFile(cleanPath, bakPath); copyErr == nil && !f.jailed() && uid >= 0 {
				_ = os.Lchown(bakPath, uid, gid)
				_ = os.Chmod(bakPath, mode)
			}
		}
		out, err := os.OpenFile(cleanPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC|syscall.O_NOFOLLOW, mode)
		if err != nil {
			return err
		}
		if _, err := out.WriteString(content); err != nil {
			out.Close()
			return err
		}
		return out.Close()
	})
	if err != nil {
		return err
	}
	if !f.jailed() {
		if uid >= 0 {
			_ = os.Lchown(cleanPath, uid, gid)
		} else {
			chownToParentOrAccount(cleanPath)
		}
	}
	return nil
}

// CreateItem creates a new file or directory
func (f *FileManagerService) CreateItem(itemPath string, isDir bool) error {
	cleanPath, err := f.resolveManagedPath(itemPath)
	if err != nil {
		return err
	}
	err = f.asOwner(func() error {
		if isDir {
			return os.MkdirAll(cleanPath, 0755)
		}
		_ = os.MkdirAll(filepath.Dir(cleanPath), 0755)
		file, err := os.OpenFile(cleanPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL|syscall.O_NOFOLLOW, 0644)
		if err != nil {
			return err
		}
		return file.Close()
	})
	if err != nil {
		return err
	}
	f.fixOwner(cleanPath)
	return nil
}

// DeleteItem removes a file or directory
func (f *FileManagerService) DeleteItem(itemPath string) error {
	cleanPath, err := f.resolveManagedPath(itemPath)
	if err != nil {
		return err
	}
	if f.jailed() && cleanPath == filepath.Clean(f.jailRoot) {
		return fmt.Errorf("access denied: the home directory itself cannot be deleted")
	}
	return f.asOwner(func() error { return os.RemoveAll(cleanPath) })
}

// RenameItem renames or moves a file/directory
func (f *FileManagerService) RenameItem(oldPath, newPath string) error {
	cleanOld, err := f.resolveManagedPath(oldPath)
	if err != nil {
		return err
	}
	cleanNew, err := f.resolveManagedPath(newPath)
	if err != nil {
		return err
	}
	return f.asOwner(func() error { return os.Rename(cleanOld, cleanNew) })
}

// CopyItems copies multiple items to destination folder
func (f *FileManagerService) CopyItems(sources []string, destDir string) error {
	cleanDest, err := f.resolveManagedPath(destDir)
	if err != nil {
		return err
	}
	for _, src := range sources {
		cleanSrc, err := f.resolveManagedPath(src)
		if err != nil {
			return err
		}
		target := filepath.Join(cleanDest, filepath.Base(cleanSrc))

		var isDir bool
		err = f.asOwner(func() error {
			_ = os.MkdirAll(cleanDest, 0755)
			info, err := os.Lstat(cleanSrc)
			if err != nil {
				return err
			}
			isDir = info.IsDir()
			if !isDir {
				return copyFile(cleanSrc, target)
			}
			return nil
		})
		if err != nil {
			return err
		}
		if isDir {
			// -P: copy symlinks as links, never follow them.
			if err := runCmd(f.command("cp", "-R", "-P", "--", cleanSrc, target)); err != nil {
				return err
			}
		}
		f.fixOwner(target)
	}
	return nil
}

// MoveItems moves multiple items to destination folder
func (f *FileManagerService) MoveItems(sources []string, destDir string) error {
	cleanDest, err := f.resolveManagedPath(destDir)
	if err != nil {
		return err
	}
	for _, src := range sources {
		cleanSrc, err := f.resolveManagedPath(src)
		if err != nil {
			return err
		}
		target := filepath.Join(cleanDest, filepath.Base(cleanSrc))
		err = f.asOwner(func() error {
			_ = os.MkdirAll(cleanDest, 0755)
			return os.Rename(cleanSrc, target)
		})
		if err != nil {
			if err := runCmd(f.command("mv", "--", cleanSrc, target)); err != nil {
				return err
			}
		}
	}
	return nil
}

// ListSubdirectories returns only directories for tree sidebar
func (f *FileManagerService) ListSubdirectories(targetPath string) ([]string, error) {
	cleanPath, err := f.resolveManagedPath(targetPath)
	if err != nil {
		return nil, err
	}
	var dirs []string
	err = f.asOwner(func() error {
		entries, err := os.ReadDir(cleanPath)
		if err != nil {
			return err
		}
		for _, e := range entries {
			if e.IsDir() {
				dirs = append(dirs, filepath.Join(cleanPath, e.Name()))
			}
		}
		return nil
	})
	return dirs, err
}

// DuplicateItem clones a file to filename_copy.ext
func (f *FileManagerService) DuplicateItem(itemPath string) (string, error) {
	cleanPath, err := f.resolveManagedPath(itemPath)
	if err != nil {
		return "", err
	}
	ext := filepath.Ext(cleanPath)
	base := strings.TrimSuffix(cleanPath, ext)
	newPath := fmt.Sprintf("%s_copy%s", base, ext)

	err = f.asOwner(func() error {
		counter := 1
		for {
			if _, err := os.Lstat(newPath); os.IsNotExist(err) {
				break
			}
			newPath = fmt.Sprintf("%s_copy%d%s", base, counter, ext)
			counter++
		}
		return copyFile(cleanPath, newPath)
	})
	if err != nil {
		return "", err
	}
	f.fixOwner(newPath)
	return newPath, nil
}

// ArchiveItems packs items into a zip or tar.gz archive
func (f *FileManagerService) ArchiveItems(destArchive string, format string, items []string) error {
	cleanDest, err := f.resolveManagedPath(destArchive)
	if err != nil {
		return err
	}
	workDir := filepath.Dir(cleanDest)

	var relItems []string
	for _, item := range items {
		cleanItem, err := f.resolveManagedPath(item)
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(workDir, cleanItem)
		if err != nil || strings.HasPrefix(rel, "..") {
			return fmt.Errorf("archive items must live inside the archive's folder")
		}
		relItems = append(relItems, "./"+rel)
	}

	var cmd *exec.Cmd
	if format == "tar.gz" || strings.HasSuffix(cleanDest, ".tar.gz") {
		cmd = f.command("tar", append([]string{"-czf", cleanDest, "--"}, relItems...)...)
	} else {
		// -y stores symlinks as links instead of archiving whatever they point at.
		cmd = f.command("zip", append([]string{"-r", "-y", cleanDest}, relItems...)...)
	}
	cmd.Dir = workDir
	if err := runCmd(cmd); err != nil {
		return err
	}
	f.fixOwner(cleanDest)
	return nil
}

func (f *FileManagerService) ExtractArchive(archivePath, destDir string) error {
	cleanArch, err := f.resolveManagedPath(archivePath)
	if err != nil {
		return err
	}
	cleanDest, err := f.resolveManagedPath(destDir)
	if err != nil {
		return err
	}
	if err := f.asOwner(func() error { return os.MkdirAll(cleanDest, 0755) }); err != nil {
		return err
	}

	var cmd *exec.Cmd
	switch {
	case strings.HasSuffix(cleanArch, ".tar.gz") || strings.HasSuffix(cleanArch, ".tgz"):
		cmd = f.command("tar", "--no-same-owner", "-xzf", cleanArch, "-C", cleanDest)
	case strings.HasSuffix(cleanArch, ".tar.bz2"):
		cmd = f.command("tar", "--no-same-owner", "-xjf", cleanArch, "-C", cleanDest)
	case strings.HasSuffix(cleanArch, ".tar"):
		cmd = f.command("tar", "--no-same-owner", "-xf", cleanArch, "-C", cleanDest)
	default:
		cmd = f.command("unzip", "-o", cleanArch, "-d", cleanDest)
	}
	if err := runCmd(cmd); err != nil {
		return err
	}
	f.fixOwner(cleanDest)
	return nil
}

// RemoteDownload fetches a public http(s) URL straight into destDir.
func (f *FileManagerService) RemoteDownload(downloadURL, destDir, customName string) error {
	u, err := ValidateRemoteURL(downloadURL)
	if err != nil {
		return err
	}
	cleanDest, err := f.resolveManagedPath(destDir)
	if err != nil {
		return err
	}

	fileName := customName
	if fileName == "" {
		fileName = filepath.Base(u.Path)
	}
	fileName = filepath.Base(fileName)
	if fileName == "" || fileName == "." || fileName == ".." || fileName == "/" {
		fileName = "downloaded_file"
	}

	targetPath := filepath.Join(cleanDest, fileName)
	if _, err := f.resolveManagedPath(targetPath); err != nil {
		return err
	}
	err = f.asOwner(func() error {
		if err := os.MkdirAll(cleanDest, 0755); err != nil {
			return err
		}
		out, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC|syscall.O_NOFOLLOW, 0644)
		if err != nil {
			return err
		}
		if err := FetchRemote(u.String(), out); err != nil {
			out.Close()
			_ = os.Remove(targetPath)
			return err
		}
		return out.Close()
	})
	if err != nil {
		return err
	}
	f.fixOwner(targetPath)
	return nil
}

// GrepSearch searches for text across files in a directory
func (f *FileManagerService) GrepSearch(dirPath, query string) ([]GrepResult, error) {
	cleanDir, err := f.resolveManagedPath(dirPath)
	if err != nil {
		return nil, err
	}
	out, _ := f.command("grep", "-rnIF", "--max-count=50", "-e", query, "--", cleanDir).Output()

	var results []GrepResult
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		parts := strings.SplitN(line, ":", 3)
		if len(parts) >= 3 {
			results = append(results, GrepResult{
				FilePath:   parts[0],
				FileName:   filepath.Base(parts[0]),
				LineNumber: parts[1],
				Snippet:    strings.TrimSpace(parts[2]),
			})
		}
		if len(results) >= 500 {
			break
		}
	}
	return results, nil
}

// GetChecksum computes MD5 and SHA256 of a file
func (f *FileManagerService) GetChecksum(filePath string) (map[string]string, error) {
	cleanPath, err := f.resolveManagedPath(filePath)
	if err != nil {
		return nil, err
	}
	md5h, shah := md5.New(), sha256.New()
	var size int64
	err = f.asOwner(func() error {
		in, err := os.Open(cleanPath)
		if err != nil {
			return err
		}
		defer in.Close()
		size, err = io.Copy(io.MultiWriter(md5h, shah), in)
		return err
	})
	if err != nil {
		return nil, err
	}
	return map[string]string{
		"md5":    hex.EncodeToString(md5h.Sum(nil)),
		"sha256": hex.EncodeToString(shah.Sum(nil)),
		"size":   fmt.Sprintf("%d bytes", size),
	}, nil
}

// CalculateDirSize calculates disk usage with du -sh
func (f *FileManagerService) CalculateDirSize(dirPath string) (string, error) {
	cleanPath, err := f.resolveManagedPath(dirPath)
	if err != nil {
		return "0 B", err
	}
	out, err := f.command("du", "-sh", "--", cleanPath).Output()
	if err != nil && len(out) == 0 {
		return "0 B", err
	}
	parts := strings.Fields(string(out))
	if len(parts) > 0 {
		return parts[0], nil
	}
	return "0 B", nil
}

func (f *FileManagerService) jailOwner() string {
	if f.tenant != nil {
		return f.tenant.Username
	}
	if f.jailRoot == "" {
		return ""
	}
	return filepath.Base(filepath.Clean(f.jailRoot))
}

var octalModeRe = regexp.MustCompile(`^[0-7]{3,4}$`)

// ChangePermissions updates octal mode and (admin only) ownership
func (f *FileManagerService) ChangePermissions(targetPath, mode, owner, group string, recursive bool) error {
	cleanPath, err := f.resolveManagedPath(targetPath)
	if err != nil {
		return err
	}
	if mode != "" && !octalModeRe.MatchString(mode) {
		return fmt.Errorf("invalid permission mode %q", mode)
	}

	if mode != "" {
		args := []string{}
		if recursive {
			args = append(args, "-R")
		}
		args = append(args, mode, "--", cleanPath)
		if err := runCmd(f.command("chmod", args...)); err != nil {
			return err
		}
	}

	// Tenants always own their files; only root may hand files to other owners.
	if f.jailed() {
		return nil
	}
	if owner != "" || group != "" {
		ownerStr := owner
		if group != "" {
			ownerStr = fmt.Sprintf("%s:%s", owner, group)
		}
		args := []string{"-h"}
		if recursive {
			args = append(args, "-R", "-P")
		}
		args = append(args, "--", ownerStr, cleanPath)
		if err := runCmd(exec.Command("chown", args...)); err != nil {
			return err
		}
	}
	return nil
}

// FixPermissions resets web tree ownership. Account homes stay user:user
// so PHP-FPM/nginx can serve sites without rewriting files to www-data.
func (f *FileManagerService) FixPermissions(targetPath string) error {
	if targetPath == "" {
		targetPath = f.defaultDir
	}
	cleanPath, err := f.resolveManagedPath(targetPath)
	if err != nil {
		return err
	}
	if f.jailed() {
		if f.tenant == nil {
			return fmt.Errorf("access denied: hosting account identity unavailable")
		}
		// Root is needed to reclaim root-owned files, so walk with openat/O_NOFOLLOW to make
		// sure no symlink swapped in by the tenant can redirect the chown outside the jail.
		return fixTreeOwnership(f.jailRoot, cleanPath, f.tenant.UID, f.tenant.GID)
	}
	owner := "www-data:www-data"
	if acc := linuxAccountFromPath(cleanPath); acc != "" {
		owner = acc + ":" + acc
	}
	_ = exec.Command("chown", "-R", "-h", "-P", "--", owner, cleanPath).Run()
	_ = exec.Command("find", "-P", cleanPath, "-type", "d", "-exec", "chmod", "755", "{}", "+").Run()
	_ = exec.Command("find", "-P", cleanPath, "-type", "f", "-exec", "chmod", "644", "{}", "+").Run()
	return nil
}

func (f *FileManagerService) FixPermissionsTargets(targets []string) error {
	if len(targets) == 0 {
		return f.FixPermissions("")
	}
	for _, t := range targets {
		if err := f.FixPermissions(t); err != nil {
			return err
		}
	}
	return nil
}

// copyFile copies a regular file without following a symlink at either end.
func copyFile(src, dst string) error {
	in, err := os.OpenFile(src, os.O_RDONLY|syscall.O_NOFOLLOW, 0)
	if err != nil {
		return err
	}
	defer in.Close()

	info, err := in.Stat()
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return fmt.Errorf("%s is not a regular file", filepath.Base(src))
	}

	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC|syscall.O_NOFOLLOW, info.Mode().Perm())
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err = io.Copy(out, in); err != nil {
		return err
	}
	return out.Close()
}

func formatHumanSize(bytes int64, isDir bool) string {
	if isDir {
		return "Folder"
	}
	if bytes == 0 {
		return "0 B"
	}
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func isImageExtension(ext string) bool {
	switch ext {
	case "png", "jpg", "jpeg", "svg", "webp", "gif", "ico", "bmp":
		return true
	}
	return false
}

func isArchiveExtension(ext string) bool {
	switch ext {
	case "zip", "tar", "gz", "tgz", "bz2", "rar", "7z":
		return true
	}
	return false
}

func isCodeExtension(ext string) bool {
	switch ext {
	case "php", "js", "jsx", "ts", "tsx", "html", "css", "json", "yaml", "yml", "sql", "py", "go", "sh", "bash", "conf", "ini", "md", "env", "xml", "toml":
		return true
	}
	return false
}

func detectMimeType(name string, isDir bool, ext string) string {
	if isDir {
		return "directory"
	}
	switch ext {
	case "php":
		return "text/x-php"
	case "sh", "bash":
		return "text/x-shellscript"
	case "py":
		return "text/x-python"
	case "pl", "perl":
		return "text/x-perl"
	case "js":
		return "application/javascript"
	case "ts":
		return "application/typescript"
	case "json":
		return "application/json"
	case "html", "htm":
		return "text/html"
	case "css":
		return "text/css"
	case "sql":
		return "text/x-sql"
	case "xml":
		return "application/xml"
	case "png":
		return "image/png"
	case "jpg", "jpeg":
		return "image/jpeg"
	case "gif":
		return "image/gif"
	case "svg":
		return "image/svg+xml"
	case "webp":
		return "image/webp"
	case "ico":
		return "image/x-icon"
	case "zip":
		return "application/zip"
	case "tar", "gz", "tgz", "bz2":
		return "application/x-compressed-tar"
	case "conf", "cfg", "ini":
		return "text/plain"
	case "log", "txt", "md":
		return "text/plain"
	case "so":
		return "application/x-sharedlib"
	default:
		return "text/plain"
	}
}
