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
}

func NewFileManagerService() *FileManagerService {
	return &FileManagerService{
		defaultDir: "/var/www/sites",
	}
}

// ListDirectory lists files and folders with full server inspection
func (f *FileManagerService) ListDirectory(targetPath string) ([]FileItem, string, error) {
	if targetPath == "" {
		targetPath = f.defaultDir
	}

	cleanPath := filepath.Clean(targetPath)
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
	cleanPath := filepath.Clean(filePath)
	data, err := os.ReadFile(cleanPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// WriteFile saves text content and automatically creates a .bak snapshot
func (f *FileManagerService) WriteFile(filePath, content string) error {
	cleanPath := filepath.Clean(filePath)

	// Create a .bak snapshot if file already exists
	if _, err := os.Stat(cleanPath); err == nil {
		bakPath := fmt.Sprintf("%s.bak", cleanPath)
		_ = copyFile(cleanPath, bakPath)
	}

	return os.WriteFile(cleanPath, []byte(content), 0644)
}

// CreateItem creates a new file or directory
func (f *FileManagerService) CreateItem(itemPath string, isDir bool) error {
	cleanPath := filepath.Clean(itemPath)
	if isDir {
		return os.MkdirAll(cleanPath, 0755)
	}
	_ = os.MkdirAll(filepath.Dir(cleanPath), 0755)
	file, err := os.Create(cleanPath)
	if err != nil {
		return err
	}
	file.Close()
	return nil
}

// DeleteItem removes a file or directory
func (f *FileManagerService) DeleteItem(itemPath string) error {
	cleanPath := filepath.Clean(itemPath)
	return os.RemoveAll(cleanPath)
}

// RenameItem renames or moves a file/directory
func (f *FileManagerService) RenameItem(oldPath, newPath string) error {
	return os.Rename(filepath.Clean(oldPath), filepath.Clean(newPath))
}

// CopyItems copies multiple items to destination folder
func (f *FileManagerService) CopyItems(sources []string, destDir string) error {
	cleanDest := filepath.Clean(destDir)
	_ = os.MkdirAll(cleanDest, 0755)

	for _, src := range sources {
		cleanSrc := filepath.Clean(src)
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
		} else {
			if err := copyFile(cleanSrc, target); err != nil {
				return err
			}
		}
	}
	return nil
}

// MoveItems moves multiple items to destination folder
func (f *FileManagerService) MoveItems(sources []string, destDir string) error {
	cleanDest := filepath.Clean(destDir)
	_ = os.MkdirAll(cleanDest, 0755)

	for _, src := range sources {
		cleanSrc := filepath.Clean(src)
		target := filepath.Join(cleanDest, filepath.Base(cleanSrc))
		if err := os.Rename(cleanSrc, target); err != nil {
			// Fallback to copy + remove if across mount points
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
	cleanPath := filepath.Clean(targetPath)
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
	cleanPath := filepath.Clean(itemPath)
	ext := filepath.Ext(cleanPath)
	base := strings.TrimSuffix(cleanPath, ext)
	newPath := fmt.Sprintf("%s_copy%s", base, ext)

	// Ensure unique name
	counter := 1
	for {
		if _, err := os.Stat(newPath); os.IsNotExist(err) {
			break
		}
		newPath = fmt.Sprintf("%s_copy%d%s", base, counter, ext)
		counter++
	}

	err := copyFile(cleanPath, newPath)
	return newPath, err
}

// ArchiveItems compresses files/folders into .zip or .tar.gz
func (f *FileManagerService) ArchiveItems(destArchive string, format string, items []string) error {
	cleanDest := filepath.Clean(destArchive)
	workDir := filepath.Dir(cleanDest)

	var relItems []string
	for _, item := range items {
		rel, err := filepath.Rel(workDir, filepath.Clean(item))
		if err == nil {
			relItems = append(relItems, rel)
		} else {
			relItems = append(relItems, filepath.Base(item))
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
	return cmd.Run()
}

// ExtractArchive uncompresses an archive into destination directory
func (f *FileManagerService) ExtractArchive(archivePath, destDir string) error {
	cleanArch := filepath.Clean(archivePath)
	cleanDest := filepath.Clean(destDir)
	_ = os.MkdirAll(cleanDest, 0755)

	var cmd *exec.Cmd
	if strings.HasSuffix(cleanArch, ".tar.gz") || strings.HasSuffix(cleanArch, ".tgz") {
		cmd = exec.Command("tar", "-xzf", cleanArch, "-C", cleanDest)
	} else if strings.HasSuffix(cleanArch, ".tar.bz2") {
		cmd = exec.Command("tar", "-xjf", cleanArch, "-C", cleanDest)
	} else if strings.HasSuffix(cleanArch, ".tar") {
		cmd = exec.Command("tar", "-xf", cleanArch, "-C", cleanDest)
	} else {
		// Default to unzip
		cmd = exec.Command("unzip", "-o", cleanArch, "-d", cleanDest)
	}
	return cmd.Run()
}

// RemoteDownload downloads a file from URL directly to VPS
func (f *FileManagerService) RemoteDownload(downloadURL, destDir, customName string) error {
	cleanDest := filepath.Clean(destDir)
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

	targetPath := filepath.Join(cleanDest, fileName)
	cmd := exec.Command("curl", "-L", "-o", targetPath, downloadURL)
	return cmd.Run()
}

// GrepSearch searches for text across files in a directory
func (f *FileManagerService) GrepSearch(dirPath, query string) ([]GrepResult, error) {
	cleanDir := filepath.Clean(dirPath)
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
	cleanPath := filepath.Clean(filePath)
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
	cleanPath := filepath.Clean(dirPath)
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
func (f *FileManagerService) ChangePermissions(targetPath, mode, owner, group string, recursive bool) error {
	cleanPath := filepath.Clean(targetPath)

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

// FixPermissions resets web permissions to www-data:www-data (755/644)
func (f *FileManagerService) FixPermissions(targetPath string) error {
	if targetPath == "" {
		targetPath = f.defaultDir
	}
	cleanPath := filepath.Clean(targetPath)
	_ = exec.Command("chown", "-R", "www-data:www-data", cleanPath).Run()
	_ = exec.Command("find", cleanPath, "-type", "d", "-exec", "chmod", "755", "{}", "+").Run()
	_ = exec.Command("find", cleanPath, "-type", "f", "-exec", "chmod", "644", "{}", "+").Run()
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
	return err
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
