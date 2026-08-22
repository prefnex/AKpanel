package middleware

import (
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
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
	if !strings.HasPrefix(path, "/public/build/") {
		ctx.Request().Next()
		return
	}

	ctx.Response().Header("Cache-Control", "public, max-age=604800, immutable")

	rel := strings.TrimPrefix(path, "/public/")
	diskPath := filepath.Join("public", rel)
	info, err := os.Stat(diskPath)
	if err != nil || info.IsDir() {
		ctx.Request().Next()
		return
	}

	accept := ctx.Request().Header("Accept-Encoding", "")
	if !strings.Contains(accept, "gzip") {
		ctx.Request().Next()
		return
	}

	ext := strings.ToLower(filepath.Ext(diskPath))
	if ext != ".js" && ext != ".css" {
		ctx.Request().Next()
		return
	}

	f, err := os.Open(diskPath)
	if err != nil {
		ctx.Request().Next()
		return
	}
	defer f.Close()

	ctx.Response().Header("Content-Encoding", "gzip")
	ctx.Response().Header("Vary", "Accept-Encoding")
	if ext == ".css" {
		ctx.Response().Header("Content-Type", "text/css; charset=utf-8")
	} else {
		ctx.Response().Header("Content-Type", "application/javascript")
	}
	_ = ctx.Response().Status(200).Stream(func(w goravelhttp.StreamWriter) error {
		gz := gzip.NewWriter(streamWriterAdapter{w: w})
		defer gz.Close()
		_, err := io.Copy(gz, f)
		return err
	})
}

type streamWriterAdapter struct {
	w goravelhttp.StreamWriter
}

func (a streamWriterAdapter) Write(p []byte) (int, error) {
	return a.w.Write(p)
}
