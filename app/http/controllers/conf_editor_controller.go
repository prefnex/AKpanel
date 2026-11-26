package controllers

import (
	"github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

// Conf editor: browse and edit nginx / Apache / Varnish / PHP-FPM configuration trees.

// ConfRoots lists the trees on this server.
func (r *WebServersController) ConfRoots(ctx http.Context) http.Response {
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": services.ConfRoots()})
}

// ConfList lists one directory (?root=&dir=).
func (r *WebServersController) ConfList(ctx http.Context) http.Response {
	l, err := services.ListConfDir(ctx.Request().Query("root"), ctx.Request().Query("dir"))
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": l})
}

// ConfRead returns one file (?root=&path=).
func (r *WebServersController) ConfRead(ctx http.Context) http.Response {
	f, err := services.ReadConfFile(ctx.Request().Query("root"), ctx.Request().Query("path"))
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "data": f})
}

// ConfSave writes a file (create=true for a new one), tests and reloads; restored on failure.
func (r *WebServersController) ConfSave(ctx http.Context) http.Response {
	var req struct {
		Root    string `json:"root"`
		Path    string `json:"path"`
		Content string `json:"content"`
		Create  bool   `json:"create"`
	}
	if err := ctx.Request().Bind(&req); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "invalid request"})
	}
	if err := services.SaveConfFile(req.Root, req.Path, req.Content, req.Create); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	msg := req.Path + " saved, tested and reloaded"
	if req.Create {
		msg = req.Path + " created, tested and reloaded"
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": msg})
}

// ConfDelete removes a file; restored if the test fails.
func (r *WebServersController) ConfDelete(ctx http.Context) http.Response {
	root, path := ctx.Request().Input("root"), ctx.Request().Input("path")
	if err := services.DeleteConfFile(root, path); err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": path + " deleted"})
}

// ConfTest runs a tree's syntax checker.
func (r *WebServersController) ConfTest(ctx http.Context) http.Response {
	out, err := services.TestConfRoot(ctx.Request().Input("root"))
	if err != nil {
		return ctx.Response().Status(422).Json(http.Json{"status": "error", "message": "Test failed", "output": out + "\n" + err.Error()})
	}
	return ctx.Response().Success().Json(http.Json{"status": "success", "message": "Syntax OK", "output": out})
}
