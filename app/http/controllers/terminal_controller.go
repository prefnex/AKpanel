package controllers

import (
	"github.com/goravel/framework/contracts/http"
	"goravel/app/services"
)

type TerminalController struct {
	terminalService *services.TerminalService
}

func NewTerminalController() *TerminalController {
	return &TerminalController{
		terminalService: services.NewTerminalService(),
	}
}

// Execute runs a command in bash
func (r *TerminalController) Execute(ctx http.Context) http.Response {
	cmdStr := ctx.Request().Input("command")
	if cmdStr == "" {
		return ctx.Response().Status(422).Json(http.Json{
			"status":  "error",
			"message": "command is required",
		})
	}

	result, err := r.terminalService.ExecuteCommand(cmdStr)
	if err != nil {
		return ctx.Response().Status(500).Json(http.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Success().Json(http.Json{
		"status": "success",
		"data":   result,
	})
}
