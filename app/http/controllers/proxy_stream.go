package controllers

import goravelhttp "github.com/goravel/framework/contracts/http"

type streamCopyWriter struct {
	w goravelhttp.StreamWriter
}

func (s streamCopyWriter) Write(p []byte) (int, error) {
	return s.w.Write(p)
}
