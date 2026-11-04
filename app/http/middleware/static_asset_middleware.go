package middleware

import (
	"strings"

	goravelhttp "github.com/goravel/framework/contracts/http"
)

type StaticAssetMiddleware struct{}

func NewStaticAssetMiddleware() *StaticAssetMiddleware {
	return &StaticAssetMiddleware{}
}

func (m *StaticAssetMiddleware) Signature() string {
	return "static_assets"
}

func (m *StaticAssetMiddleware) Handle(ctx goravelhttp.Context) {
	path := "/" + strings.TrimPrefix(ctx.Request().Path(), "/")
	if strings.HasPrefix(path, "/public/build/") {
		// Bundle names are not content-hashed (app.js, app.css), so browsers must revalidate on
		// every load; unchanged files come back as a cheap 304 via Last-Modified.
		ctx.Response().Header("Cache-Control", "no-cache")
	}
	ctx.Request().Next()
}
