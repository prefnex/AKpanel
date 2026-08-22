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
		ctx.Response().Header("Cache-Control", "public, max-age=604800, immutable")
	}
	ctx.Request().Next()
}
