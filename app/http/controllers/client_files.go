package controllers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/goravel/framework/contracts/http"

	"goravel/app/paths"
	"goravel/app/services"
)

func (c *ClientController) jailedFileManager(ctx http.Context) (*services.FileManagerService, string, http.Response) {
	username, fail := c.requireUsername(ctx)
	if fail != nil {
		return nil, "", fail
	}
	if username == "root" || strings.Contains(username, "/") || strings.Contains(username, "..") {
		return nil, "", ctx.Response().Status(403).Json(http.Json{
			"status":  "error",
			"message": "access denied",
		})
	}
	home := paths.UserHome(username)
	_ = os.MkdirAll(home, 0750)
	return services.NewFileManagerService().WithJail(home), username, nil
}

func clientFileErr(ctx http.Context, err error) http.Response {
	return ctx.Response().Status(403).Json(http.Json{"status": "error", "message": err.Error()})
}

func (c *ClientController) Files(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path", "")
	items, currentPath, err := svc.ListDirectory(path)
	if err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{
		"status":       "success",
		"current_path": currentPath,
		"data":         items,
		"files":        items,
	})
}

func (c *ClientController) FilesSubdirs(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path", "")
	dirs, err := svc.ListSubdirectories(path)
	if err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": dirs})
}

func (c *ClientController) ReadFile(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path")
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "path is required"})
	}
	content, err := svc.ReadFile(path)
	if err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "content": content, "path": path})
}

func (c *ClientController) SaveFile(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path")
	content := ctx.Request().Input("content")
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "path is required"})
	}
	if err := svc.WriteFile(path, content); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "File saved successfully"})
}

func (c *ClientController) CreateFile(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path")
	name := ctx.Request().Input("name")
	isDir := ctx.Request().InputBool("is_dir", false)
	if name != "" {
		if path == "" {
			path = name
		} else {
			path = filepath.Join(path, name)
		}
	}
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "path is required"})
	}
	if err := svc.CreateItem(path, isDir); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Item created successfully"})
}

func (c *ClientController) CreateFolder(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path")
	name := ctx.Request().Input("name")
	if name != "" {
		path = filepath.Join(path, name)
	}
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "path is required"})
	}
	if err := svc.CreateItem(path, true); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Folder created successfully"})
}

func (c *ClientController) DeleteFile(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path")
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "path is required"})
	}
	if err := svc.DeleteItem(path); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Item deleted successfully"})
}

func (c *ClientController) RenameFile(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	oldPath := ctx.Request().Input("old_path")
	newPath := ctx.Request().Input("new_path")
	newName := ctx.Request().Input("new_name")
	if oldPath == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "old_path is required"})
	}
	if newPath == "" && newName != "" {
		newPath = filepath.Join(filepath.Dir(oldPath), newName)
	}
	if newPath == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "new_path is required"})
	}
	if err := svc.RenameItem(oldPath, newPath); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Item renamed successfully"})
}

func (c *ClientController) ChmodFile(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path")
	mode := ctx.Request().Input("mode")
	owner := ctx.Request().Input("owner")
	group := ctx.Request().Input("group")
	recursive := ctx.Request().InputBool("recursive", false)
	if path == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "path is required"})
	}
	if err := svc.ChangePermissions(path, mode, owner, group, recursive); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Permissions and ownership updated"})
}

func (c *ClientController) ExtractArchive(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	archive := ctx.Request().Input("archive_path")
	dest := ctx.Request().Input("dest_dir")
	if dest == "" {
		dest = ctx.Request().Input("dest_path")
	}
	if archive == "" || dest == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "archive_path and dest_dir are required"})
	}
	if err := svc.ExtractArchive(archive, dest); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Archive extracted successfully"})
}

func (c *ClientController) CompressArchive(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	dest := ctx.Request().Input("dest_archive")
	format := ctx.Request().Input("format", "zip")
	items := ctx.Request().InputArray("items")
	if dest == "" {
		targetDir := ctx.Request().Input("target_dir")
		archiveName := ctx.Request().Input("archive_name")
		if targetDir != "" && archiveName != "" {
			dest = filepath.Join(targetDir, archiveName)
		}
	}
	if len(items) == 0 {
		items = ctx.Request().InputArray("files")
	}
	if dest == "" || len(items) == 0 {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "dest_archive and items are required"})
	}
	if err := svc.ArchiveItems(dest, format, items); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": fmt.Sprintf("Archive '%s' created", filepath.Base(dest))})
}

func (c *ClientController) FilesCopy(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	destDir := ctx.Request().Input("dest_dir")
	sources := ctx.Request().InputArray("sources")
	if destDir == "" || len(sources) == 0 {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "dest_dir and sources required"})
	}
	if err := svc.CopyItems(sources, destDir); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": fmt.Sprintf("%d items copied", len(sources))})
}

func (c *ClientController) FilesMove(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	destDir := ctx.Request().Input("dest_dir")
	sources := ctx.Request().InputArray("sources")
	if destDir == "" || len(sources) == 0 {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "dest_dir and sources required"})
	}
	if err := svc.MoveItems(sources, destDir); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": fmt.Sprintf("%d items moved", len(sources))})
}

func (c *ClientController) FilesDuplicate(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path")
	newPath, err := svc.DuplicateItem(path)
	if err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Item duplicated", "new_path": newPath})
}

func (c *ClientController) FilesRemoteDownload(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	url := ctx.Request().Input("url")
	destDir := ctx.Request().Input("dest_dir")
	customName := ctx.Request().Input("filename", "")
	if url == "" || destDir == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "url and dest_dir are required"})
	}
	if err := svc.RemoteDownload(url, destDir, customName); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "File downloaded"})
}

func (c *ClientController) FilesGrep(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	dir := ctx.Request().Input("dir_path")
	query := ctx.Request().Input("query")
	if dir == "" || query == "" {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "dir_path and query are required"})
	}
	results, err := svc.GrepSearch(dir, query)
	if err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": results})
}

func (c *ClientController) SearchFiles(ctx http.Context) http.Response {
	return c.FilesGrep(ctx)
}

func (c *ClientController) FilesChecksum(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path")
	sums, err := svc.GetChecksum(path)
	if err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": sums})
}

func (c *ClientController) FilesDirSize(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path")
	size, err := svc.CalculateDirSize(path)
	if err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "size": size})
}

func (c *ClientController) FilesFixPermissions(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	targets := ctx.Request().InputArray("paths")
	if len(targets) == 0 {
		if p := ctx.Request().Input("path"); p != "" {
			targets = []string{p}
		}
	}
	if err := svc.FixPermissionsTargets(targets); err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Success().Json(http.Json{
		"status":  "success",
		"message": "Permissions repaired (user:user, folders 755, files 644)",
	})
}

func (c *ClientController) FilesDownload(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	path := ctx.Request().Input("path")
	cleanPath, err := svc.ValidateJailPath(path)
	if err != nil {
		return clientFileErr(ctx, err)
	}
	return ctx.Response().Download(cleanPath, filepath.Base(cleanPath))
}

func (c *ClientController) FilesUpload(ctx http.Context) http.Response {
	svc, _, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	destDir := ctx.Request().Input("dest_dir", "")
	cleanDest, err := svc.ValidateJailPath(destDir)
	if err != nil {
		return clientFileErr(ctx, err)
	}
	_ = os.MkdirAll(cleanDest, 0755)

	fileHeader, err := ctx.Request().File("file")
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "No file uploaded"})
	}
	fileName := filepath.Base(fileHeader.GetClientOriginalName())
	if _, err := svc.ValidateJailPath(filepath.Join(cleanDest, fileName)); err != nil {
		return clientFileErr(ctx, err)
	}
	if _, err := fileHeader.StoreAs(cleanDest, fileName); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": "error", "message": err.Error()})
	}
	_ = svc.ChangePermissions(filepath.Join(cleanDest, fileName), "0644", "", "", false)
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": fmt.Sprintf("File '%s' uploaded", fileName)})
}

func (c *ClientController) GitClone(ctx http.Context) http.Response {
	svc, username, fail := c.jailedFileManager(ctx)
	if fail != nil {
		return fail
	}
	destPath := ctx.Request().Input("dest_path")
	repoURL := ctx.Request().Input("repo_url")
	if repoURL == "" {
		return ctx.Response().Status(400).Json(http.Json{"status": "error", "message": "Git repository URL is required."})
	}
	if err := c.clientService.GitCloneClientRepo(username, destPath, repoURL); err != nil {
		return ctx.Response().Status(500).Json(http.Json{"status": "error", "message": err.Error()})
	}
	_ = svc.FixPermissions(destPath)
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Repository cloned successfully!"})
}
