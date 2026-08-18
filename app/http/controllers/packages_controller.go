package controllers

import (
	goravelhttp "github.com/goravel/framework/contracts/http"

	"goravel/app/services"
)

type PackagesController struct {
	packagesService *services.PackagesService
}

func NewPackagesController() *PackagesController {
	return &PackagesController{
		packagesService: services.NewPackagesService(),
	}
}

// Index lists all hosting packages
func (c *PackagesController) Index(ctx goravelhttp.Context) goravelhttp.Response {
	list := c.packagesService.ListPackages()
	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status": "success",
		"data":   list,
	})
}

// Store creates or updates a hosting package
func (c *PackagesController) Store(ctx goravelhttp.Context) goravelhttp.Response {
	var pkg services.HostingPackage
	if err := ctx.Request().Bind(&pkg); err != nil {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Invalid package data: " + err.Error(),
		})
	}

	if pkg.Name == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Package name is required",
		})
	}

	if err := c.packagesService.SavePackage(pkg); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Hosting package saved successfully!",
	})
}

// Destroy deletes a package
func (c *PackagesController) Destroy(ctx goravelhttp.Context) goravelhttp.Response {
	id := ctx.Request().Input("id")
	if id == "" {
		return ctx.Response().Status(400).Json(goravelhttp.Json{
			"status":  "error",
			"message": "Package ID is required",
		})
	}

	if err := c.packagesService.DeletePackage(id); err != nil {
		return ctx.Response().Status(500).Json(goravelhttp.Json{
			"status":  "error",
			"message": err.Error(),
		})
	}

	return ctx.Response().Status(200).Json(goravelhttp.Json{
		"status":  "success",
		"message": "Hosting package deleted successfully!",
	})
}
