package services

import (
	"bytes"
	"os"
	"path/filepath"
)

// fsTxn records the original state of every path it touches so a batch of config writes
// can be undone when a syntax test or a service restart fails.
type fsTxn struct {
	saved map[string]*savedPath
	order []string
	dirty bool
}

type savedPath struct {
	exists bool
	link   string // symlink target when the path was a symlink
	data   []byte
	mode   os.FileMode
}

func newFSTxn() *fsTxn {
	return &fsTxn{saved: map[string]*savedPath{}}
}

func (t *fsTxn) remember(path string) {
	if _, ok := t.saved[path]; ok {
		return
	}
	sp := &savedPath{}
	if fi, err := os.Lstat(path); err == nil {
		sp.exists = true
		sp.mode = fi.Mode()
		if fi.Mode()&os.ModeSymlink != 0 {
			sp.link, _ = os.Readlink(path)
		} else {
			sp.data, _ = os.ReadFile(path)
		}
	}
	t.saved[path] = sp
	t.order = append(t.order, path)
}

// Write sets path's content; returns whether anything changed.
func (t *fsTxn) Write(path, content string, mode os.FileMode) error {
	if cur, err := os.ReadFile(path); err == nil && bytes.Equal(cur, []byte(content)) {
		if fi, err := os.Lstat(path); err == nil && fi.Mode()&os.ModeSymlink == 0 {
			return nil
		}
	}
	t.remember(path)
	t.dirty = true
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	_ = os.Remove(path)
	return os.WriteFile(path, []byte(content), mode)
}

// Symlink makes path a symlink to target.
func (t *fsTxn) Symlink(target, path string) error {
	if cur, err := os.Readlink(path); err == nil && cur == target {
		return nil
	}
	t.remember(path)
	t.dirty = true
	_ = os.MkdirAll(filepath.Dir(path), 0755)
	_ = os.Remove(path)
	return os.Symlink(target, path)
}

// Remove deletes path if present.
func (t *fsTxn) Remove(path string) {
	if _, err := os.Lstat(path); err != nil {
		return
	}
	t.remember(path)
	t.dirty = true
	_ = os.Remove(path)
}

// Changed reports whether any path under one of the prefixes was modified.
func (t *fsTxn) Changed(prefixes ...string) bool {
	for _, p := range t.order {
		for _, pre := range prefixes {
			if len(p) >= len(pre) && p[:len(pre)] == pre {
				return true
			}
		}
	}
	return false
}

// Rollback restores every touched path, newest first.
func (t *fsTxn) Rollback() {
	for i := len(t.order) - 1; i >= 0; i-- {
		path := t.order[i]
		sp := t.saved[path]
		_ = os.Remove(path)
		if !sp.exists {
			continue
		}
		if sp.link != "" {
			_ = os.Symlink(sp.link, path)
			continue
		}
		_ = os.WriteFile(path, sp.data, sp.mode.Perm())
	}
}
