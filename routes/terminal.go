package routes

import (
	"goravel/app/facades"
	"goravel/app/http/controllers"
)

func registerTerminalRoutes(terminalController *controllers.TerminalController) {
	// Web Terminal API
	facades.Route().Post("/api/terminal/exec", terminalController.Execute)
}
