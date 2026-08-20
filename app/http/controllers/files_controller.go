package controllers

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/paths"
	"goravel/app/services"
)

type FilesController struct {
	fileService *services.FileManagerService
}

func NewFilesController() *FilesController {
	return &FilesController{
		fileService: services.NewFileManagerService(),
	}
}

// Index lists directory contents
func (r *FilesController) Index(ctx http.Context) http.Response {
	path := ctx.Request().Input("path", paths.SitesRoot)
	items, currentPath, err := r.fileService.ListDirectory(path)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":       "success",
		"current_path": currentPath,
		"data":         items,
	})
}

// Read returns text file content
func (r *FilesController) Read(ctx http.Context) http.Response {
	path := ctx.Request().Input("path")
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "path is required",
		})
	}

	content, err := r.fileService.ReadFile(path)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"content": content,
	})
}

// Save writes content to file
func (r *FilesController) Save(ctx http.Context) http.Response {
	path := ctx.Request().Input("path")
	content := ctx.Request().Input("content")

	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "path is required",
		})
	}

	if err := r.fileService.WriteFile(path, content); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "File saved successfully (snapshot backup created)",
	})
}

// Create creates a new file or directory
func (r *FilesController) Create(ctx http.Context) http.Response {
	path := ctx.Request().Input("path")
	isDir := ctx.Request().InputBool("is_dir", false)

	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "path is required",
		})
	}

	if err := r.fileService.CreateItem(path, isDir); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Item created successfully",
	})
}

// Destroy deletes a file or directory
func (r *FilesController) Destroy(ctx http.Context) http.Response {
	path := ctx.Request().Input("path")
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "path is required",
		})
	}

	if err := r.fileService.DeleteItem(path); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Item deleted successfully",
	})
}

// Rename renames or moves a file
func (r *FilesController) Rename(ctx http.Context) http.Response {
	oldPath := ctx.Request().Input("old_path")
	newPath := ctx.Request().Input("new_path")

	if oldPath == "" || newPath == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "old_path and new_path are required",
		})
	}

	if err := r.fileService.RenameItem(oldPath, newPath); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Item renamed/moved successfully",
	})
}

// Copy copies items to dest_dir
func (r *FilesController) Copy(ctx http.Context) http.Response {
	destDir := ctx.Request().Input("dest_dir")
	sources := ctx.Request().InputArray("sources")

	if destDir == "" || len(sources) == 0 {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "dest_dir and sources array required",
		})
	}

	if err := r.fileService.CopyItems(sources, destDir); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("%d items copied successfully", len(sources)),
	})
}

// Move moves items to dest_dir
func (r *FilesController) Move(ctx http.Context) http.Response {
	destDir := ctx.Request().Input("dest_dir")
	sources := ctx.Request().InputArray("sources")

	if destDir == "" || len(sources) == 0 {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "dest_dir and sources array required",
		})
	}

	if err := r.fileService.MoveItems(sources, destDir); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("%d items moved successfully", len(sources)),
	})
}

// Subdirs lists only directories for path tree
func (r *FilesController) Subdirs(ctx http.Context) http.Response {
	path := ctx.Request().Input("path", "/var/www/sites")
	dirs, err := r.fileService.ListSubdirectories(path)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   dirs,
	})
}

// Duplicate clones a file
func (r *FilesController) Duplicate(ctx http.Context) http.Response {
	path := ctx.Request().Input("path")
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "path is required",
		})
	}

	newPath, err := r.fileService.DuplicateItem(path)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":   "success",
		"message":  "Item duplicated successfully",
		"new_path": newPath,
	})
}

// Archive compresses items into .zip or .tar.gz
func (r *FilesController) Archive(ctx http.Context) http.Response {
	dest := ctx.Request().Input("dest_archive")
	format := ctx.Request().Input("format", "zip")
	items := ctx.Request().InputArray("items")

	if dest == "" || len(items) == 0 {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "dest_archive and items array are required",
		})
	}

	if err := r.fileService.ArchiveItems(dest, format, items); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("Archive '%s' created successfully", filepath.Base(dest)),
	})
}

// Extract unzips/untar archive
func (r *FilesController) Extract(ctx http.Context) http.Response {
	archive := ctx.Request().Input("archive_path")
	dest := ctx.Request().Input("dest_dir")

	if archive == "" || dest == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "archive_path and dest_dir are required",
		})
	}

	if err := r.fileService.ExtractArchive(archive, dest); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Archive extracted successfully",
	})
}

// RemoteDownload downloads from URL to VPS
func (r *FilesController) RemoteDownload(ctx http.Context) http.Response {
	url := ctx.Request().Input("url")
	destDir := ctx.Request().Input("dest_dir")
	customName := ctx.Request().Input("filename", "")

	if url == "" || destDir == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "url and dest_dir are required",
		})
	}

	if err := r.fileService.RemoteDownload(url, destDir, customName); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Remote file downloaded directly onto VPS at Gigabit speed!",
	})
}

// Grep searches text inside files
func (r *FilesController) Grep(ctx http.Context) http.Response {
	dir := ctx.Request().Input("dir_path")
	query := ctx.Request().Input("query")

	if dir == "" || query == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "dir_path and query are required",
		})
	}

	results, err := r.fileService.GrepSearch(dir, query)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   results,
	})
}

// Checksum returns MD5 and SHA256 of file
func (r *FilesController) Checksum(ctx http.Context) http.Response {
	path := ctx.Request().Input("path")
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "path is required",
		})
	}

	sums, err := r.fileService.GetChecksum(path)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   sums,
	})
}

// DirSize calculates directory size
func (r *FilesController) DirSize(ctx http.Context) http.Response {
	path := ctx.Request().Input("path")
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "path is required",
		})
	}

	size, err := r.fileService.CalculateDirSize(path)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"size":   size,
	})
}

// Chmod updates file/directory permissions
func (r *FilesController) Chmod(ctx http.Context) http.Response {
	path := ctx.Request().Input("path")
	mode := ctx.Request().Input("mode")
	owner := ctx.Request().Input("owner")
	group := ctx.Request().Input("group")
	recursive := ctx.Request().InputBool("recursive", false)

	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "path is required",
		})
	}

	if err := r.fileService.ChangePermissions(path, mode, owner, group, recursive); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Permissions and ownership updated successfully",
	})
}

// FixPermissions resets web permissions
func (r *FilesController) FixPermissions(ctx http.Context) http.Response {
	path := ctx.Request().Input("path", "/var/www/sites")
	if err := r.fileService.FixPermissions(path); err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Permissions fixed to www-data:www-data (755/644) successfully",
	})
}

// Download serves a file directly for download
func (r *FilesController) Download(ctx http.Context) http.Response {
	path := ctx.Request().Input("path")
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{"error": "path required"})
	}
	cleanPath := filepath.Clean(path)
	return ctx.Response().Download(cleanPath, filepath.Base(cleanPath))
}

// Upload handles multipart file upload
func (r *FilesController) Upload(ctx http.Context) http.Response {
	destDir := ctx.Request().Input("dest_dir", "/var/www/sites")
	cleanDest := filepath.Clean(destDir)
	_ = os.MkdirAll(cleanDest, 0755)

	fileHeader, err := ctx.Request().File("file")
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "No file uploaded",
		})
	}

	fileName := fileHeader.GetClientOriginalName()
	if _, err := fileHeader.StoreAs(cleanDest, fileName); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": "error", "message": err.Error()})
	}

	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": fmt.Sprintf("File '%s' uploaded successfully", fileName),
	})
}
