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

	// Ensure path exists, create default if missing
	if _, err := os.Stat(cleanPath); os.IsNotExist(err) {
		if cleanPath == f.defaultDir {
			_ = os.MkdirAll(cleanPath, 0755)
		} else {
			return nil, cleanPath, fmt.Errorf("directory '%s' does not exist", cleanPath)
		}
	}

	entries, err := os.ReadDir(cleanPath)
	if err != nil {
		return nil, cleanPath, err
	}

	var items []FileItem
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
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

		octal := fmt.Sprintf("%04o", info.Mode().Perm())
		mime := detectMimeType(entry.Name(), entry.IsDir(), ext)
		dateFmt := info.ModTime().Format("02/01/06 15:04")

		isImg := isImageExtension(ext)
		isArch := isArchiveExtension(ext)
		isCode := isCodeExtension(ext)

		items = append(items, FileItem{
			Name:          entry.Name(),
			Path:          itemPath,
			IsDir:         entry.IsDir(),
			Size:          info.Size(),
			HumanSize:     formatHumanSize(info.Size(), entry.IsDir()),
			Permissions:   info.Mode().String(),
			OctalPerm:     octal,
			Owner:         ownerName,
			Group:         groupName,
			ModTime:       info.ModTime(),
			DateFormatted: dateFmt,
			MimeType:      mime,
			Extension:     ext,
			IsImage:       isImg,
			IsArchive:     isArch,
			IsCode:        isCode,
		})
	}

	return items, cleanPath, nil
}

// ReadFile reads the text content of a file
func (f *FileManagerService) ReadFile(filePath string) (string, error) {
	cleanPath, err := f.resolveManagedPath(filePath)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(cleanPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
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
	_ = os.Chown(dst, int(st.Uid), int(st.Gid))
	if !info.IsDir() {
		_ = os.Chmod(dst, info.Mode().Perm())
	}
}

func chownToParentOrAccount(path string) {
	if acc := linuxAccountFromPath(path); acc != "" {
		_ = exec.Command("chown", acc+":"+acc, path).Run()
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

	mode := os.FileMode(0644)
	var uid, gid int = -1, -1
	if info, err := os.Stat(cleanPath); err == nil {
		mode = info.Mode().Perm()
		if st, ok := info.Sys().(*syscall.Stat_t); ok {
			uid, gid = int(st.Uid), int(st.Gid)
		}
		bakPath := fmt.Sprintf("%s.bak", cleanPath)
		if copyErr := copyFile(cleanPath, bakPath); copyErr == nil {
			if uid >= 0 {
				_ = os.Chown(bakPath, uid, gid)
				_ = os.Chmod(bakPath, mode)
			} else {
				chownToParentOrAccount(bakPath)
			}
		}
	}

	if err := os.WriteFile(cleanPath, []byte(content), mode); err != nil {
		return err
	}
	if uid >= 0 {
		_ = os.Chown(cleanPath, uid, gid)
		_ = os.Chmod(cleanPath, mode)
	} else {
		chownToParentOrAccount(cleanPath)
	}
	return nil
}

// CreateItem creates a new file or directory
func (f *FileManagerService) CreateItem(itemPath string, isDir bool) error {
	cleanPath, err := f.resolveManagedPath(itemPath)
	if err != nil {
		return err
	}
	if isDir {
		return os.MkdirAll(cleanPath, 0755)
	}
	_ = os.MkdirAll(filepath.Dir(cleanPath), 0755)
	file, err := os.Create(cleanPath)
	if err != nil {
		return err
	}
	file.Close()
	chownToParentOrAccount(cleanPath)
	return nil
}

// DeleteItem removes a file or directory
func (f *FileManagerService) DeleteItem(itemPath string) error {
	cleanPath, err := f.resolveManagedPath(itemPath)
	if err != nil {
		return err
	}
	return os.RemoveAll(cleanPath)
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
	return os.Rename(cleanOld, cleanNew)
}

// CopyItems copies multiple items to destination folder
func (f *FileManagerService) CopyItems(sources []string, destDir string) error {
	cleanDest, err := f.resolveManagedPath(destDir)
	if err != nil {
		return err
	}
	_ = os.MkdirAll(cleanDest, 0755)

	for _, src := range sources {
		cleanSrc, err := f.resolveManagedPath(src)
		if err != nil {
			return err
		}
		target := filepath.Join(cleanDest, filepath.Base(cleanSrc))

		info, err := os.Stat(cleanSrc)
		if err != nil {
			continue
		}

		if info.IsDir() {
			cmd := exec.Command("cp", "-r", cleanSrc, target)
			if err := cmd.Run(); err != nil {
				return err
			}
			chownToParentOrAccount(target)
		} else {
			if err := copyFile(cleanSrc, target); err != nil {
				return err
			}
			chownToParentOrAccount(target)
		}
	}
	return nil
}

// MoveItems moves multiple items to destination folder
func (f *FileManagerService) MoveItems(sources []string, destDir string) error {
	cleanDest, err := f.resolveManagedPath(destDir)
	if err != nil {
		return err
	}
	_ = os.MkdirAll(cleanDest, 0755)

	for _, src := range sources {
		cleanSrc, err := f.resolveManagedPath(src)
		if err != nil {
			return err
		}
		target := filepath.Join(cleanDest, filepath.Base(cleanSrc))
		if err := os.Rename(cleanSrc, target); err != nil {
			cmd := exec.Command("mv", cleanSrc, target)
			if err := cmd.Run(); err != nil {
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
	entries, err := os.ReadDir(cleanPath)
	if err != nil {
		return nil, err
	}

	var dirs []string
	for _, e := range entries {
		if e.IsDir() {
			dirs = append(dirs, filepath.Join(cleanPath, e.Name()))
		}
	}
	return dirs, nil
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

	counter := 1
	for {
		if _, err := os.Stat(newPath); os.IsNotExist(err) {
			break
		}
		newPath = fmt.Sprintf("%s_copy%d%s", base, counter, ext)
		counter++
	}

	if err := copyFile(cleanPath, newPath); err != nil {
		return "", err
	}
	chownToParentOrAccount(newPath)
	return newPath, nil
}

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
		if err == nil {
			relItems = append(relItems, rel)
		} else {
			relItems = append(relItems, filepath.Base(cleanItem))
		}
	}

	var cmd *exec.Cmd
	if format == "tar.gz" || strings.HasSuffix(cleanDest, ".tar.gz") {
		args := append([]string{"-czf", cleanDest}, relItems...)
		cmd = exec.Command("tar", args...)
	} else {
		args := append([]string{"-r", cleanDest}, relItems...)
		cmd = exec.Command("zip", args...)
	}
	cmd.Dir = workDir
	if err := cmd.Run(); err != nil {
		return err
	}
	chownToParentOrAccount(cleanDest)
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
	_ = os.MkdirAll(cleanDest, 0755)

	var cmd *exec.Cmd
	if strings.HasSuffix(cleanArch, ".tar.gz") || strings.HasSuffix(cleanArch, ".tgz") {
		cmd = exec.Command("tar", "-xzf", cleanArch, "-C", cleanDest)
	} else if strings.HasSuffix(cleanArch, ".tar.bz2") {
		cmd = exec.Command("tar", "-xjf", cleanArch, "-C", cleanDest)
	} else if strings.HasSuffix(cleanArch, ".tar") {
		cmd = exec.Command("tar", "-xf", cleanArch, "-C", cleanDest)
	} else {
		cmd = exec.Command("unzip", "-o", cleanArch, "-d", cleanDest)
	}
	if err := cmd.Run(); err != nil {
		return err
	}
	chownToParentOrAccount(cleanDest)
	return nil
}

// RemoteDownload downloads a file from URL directly to VPS
func (f *FileManagerService) RemoteDownload(downloadURL, destDir, customName string) error {
	cleanDest, err := f.resolveManagedPath(destDir)
	if err != nil {
		return err
	}
	_ = os.MkdirAll(cleanDest, 0755)

	fileName := customName
	if fileName == "" {
		fileName = filepath.Base(downloadURL)
		if idx := strings.Index(fileName, "?"); idx != -1 {
			fileName = fileName[:idx]
		}
		if fileName == "" || fileName == "/" {
			fileName = "downloaded_file"
		}
	}
	fileName = filepath.Base(fileName)
	if fileName == "" || fileName == "." || fileName == ".." {
		fileName = "downloaded_file"
	}

	targetPath := filepath.Join(cleanDest, fileName)
	if _, err := f.resolveManagedPath(targetPath); err != nil {
		return err
	}
	cmd := exec.Command("curl", "-L", "-o", targetPath, downloadURL)
	if err := cmd.Run(); err != nil {
		return err
	}
	chownToParentOrAccount(targetPath)
	return nil
}

// GrepSearch searches for text across files in a directory
func (f *FileManagerService) GrepSearch(dirPath, query string) ([]GrepResult, error) {
	cleanDir, err := f.resolveManagedPath(dirPath)
	if err != nil {
		return nil, err
	}
	cmd := exec.Command("grep", "-rnI", "--max-count=50", query, cleanDir)
	out, _ := cmd.Output()

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
	}
	return results, nil
}

// GetChecksum computes MD5 and SHA256 of a file
func (f *FileManagerService) GetChecksum(filePath string) (map[string]string, error) {
	cleanPath, err := f.resolveManagedPath(filePath)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(cleanPath)
	if err != nil {
		return nil, err
	}

	md5Hash := md5.Sum(data)
	sha256Hash := sha256.Sum256(data)

	return map[string]string{
		"md5":    hex.EncodeToString(md5Hash[:]),
		"sha256": hex.EncodeToString(sha256Hash[:]),
		"size":   fmt.Sprintf("%d bytes", len(data)),
	}, nil
}

// CalculateDirSize calculates disk usage with du -sh
func (f *FileManagerService) CalculateDirSize(dirPath string) (string, error) {
	cleanPath, err := f.resolveManagedPath(dirPath)
	if err != nil {
		return "0 B", err
	}
	out, err := exec.Command("du", "-sh", cleanPath).Output()
	if err != nil {
		return "0 B", err
	}
	parts := strings.Fields(string(out))
	if len(parts) > 0 {
		return parts[0], nil
	}
	return "0 B", nil
}

// ChangePermissions updates octal mode and ownership
func (f *FileManagerService) jailOwner() string {
	if f.jailRoot == "" {
		return ""
	}
	return filepath.Base(filepath.Clean(f.jailRoot))
}

func (f *FileManagerService) ChangePermissions(targetPath, mode, owner, group string, recursive bool) error {
	cleanPath, err := f.resolveManagedPath(targetPath)
	if err != nil {
		return err
	}
	if acc := f.jailOwner(); acc != "" {
		owner, group = acc, acc
	}

	if mode != "" {
		args := []string{}
		if recursive {
			args = append(args, "-R")
		}
		args = append(args, mode, cleanPath)
		_ = exec.Command("chmod", args...).Run()
	}

	if owner != "" || group != "" {
		ownerStr := owner
		if group != "" {
			ownerStr = fmt.Sprintf("%s:%s", owner, group)
		}
		args := []string{}
		if recursive {
			args = append(args, "-R")
		}
		args = append(args, ownerStr, cleanPath)
		_ = exec.Command("chown", args...).Run()
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
	owner := "www-data:www-data"
	if acc := f.jailOwner(); acc != "" {
		owner = acc + ":" + acc
	} else if acc := linuxAccountFromPath(cleanPath); acc != "" {
		owner = acc + ":" + acc
	}
	_ = exec.Command("chown", "-R", owner, cleanPath).Run()
	_ = exec.Command("find", cleanPath, "-type", "d", "-exec", "chmod", "755", "{}", "+").Run()
	_ = exec.Command("find", cleanPath, "-type", "f", "-exec", "chmod", "644", "{}", "+").Run()
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

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	if err != nil {
		return err
	}
	_ = out.Close()
	chownLike(src, dst)
	return nil
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
