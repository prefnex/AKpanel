// Package templates holds every web server config AKpanel generates. The files are embedded
// in the binary; an admin can override any of them by saving a copy under
// /etc/akpanel/templates/<engine>/<name> (the "Templates" page does this), and delete the copy
// to go back to the shipped version.
package templates

import (
	"bytes"
	"embed"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"text/template"
)

//go:embed nginx/*.tmpl apache/*.tmpl varnish/*.tmpl php-fpm/*.tmpl
var shipped embed.FS

// OverrideDir is where admin edits live.
const OverrideDir = "/etc/akpanel/templates"

// Engines that have templates.
var Engines = []string{"nginx", "apache", "varnish", "php-fpm"}

// File describes one template for the editor.
type File struct {
	Engine     string `json:"engine"`
	Name       string `json:"name"`
	Overridden bool   `json:"overridden"`
}

func validName(engine, name string) error {
	ok := false
	for _, e := range Engines {
		if e == engine {
			ok = true
		}
	}
	if !ok || name == "" || name != filepath.Base(name) || !strings.HasSuffix(name, ".tmpl") {
		return fmt.Errorf("unknown template %s/%s", engine, name)
	}
	if _, err := fs.Stat(shipped, engine+"/"+name); err != nil {
		return fmt.Errorf("unknown template %s/%s", engine, name)
	}
	return nil
}

func overridePath(engine, name string) string {
	return filepath.Join(OverrideDir, engine, name)
}

// List returns every shipped template and whether it is overridden.
func List() []File {
	var out []File
	for _, e := range Engines {
		entries, _ := fs.ReadDir(shipped, e)
		for _, ent := range entries {
			_, err := os.Stat(overridePath(e, ent.Name()))
			out = append(out, File{Engine: e, Name: ent.Name(), Overridden: err == nil})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Engine+out[i].Name < out[j].Engine+out[j].Name })
	return out
}

// Source returns the effective template text (override if present).
func Source(engine, name string) (string, bool, error) {
	if err := validName(engine, name); err != nil {
		return "", false, err
	}
	if b, err := os.ReadFile(overridePath(engine, name)); err == nil {
		return string(b), true, nil
	}
	b, err := shipped.ReadFile(engine + "/" + name)
	return string(b), false, err
}

// Default returns the shipped template text.
func Default(engine, name string) (string, error) {
	if err := validName(engine, name); err != nil {
		return "", err
	}
	b, err := shipped.ReadFile(engine + "/" + name)
	return string(b), err
}

// SaveOverride validates (parses) and stores an admin edit.
func SaveOverride(engine, name, content string) error {
	if err := validName(engine, name); err != nil {
		return err
	}
	if _, err := parse(name, content); err != nil {
		return fmt.Errorf("template does not parse: %w", err)
	}
	p := overridePath(engine, name)
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return err
	}
	return os.WriteFile(p, []byte(content), 0644)
}

// ResetOverride removes an admin edit.
func ResetOverride(engine, name string) error {
	if err := validName(engine, name); err != nil {
		return err
	}
	err := os.Remove(overridePath(engine, name))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}

func parse(name, text string) (*template.Template, error) {
	return template.New(name).Option("missingkey=error").Funcs(template.FuncMap{
		"join": strings.Join,
		// origin passes the site plus a flag into the shared "origin" block.
		"origin": func(site any, proxied bool) map[string]any {
			return map[string]any{"S": site, "Proxied": proxied}
		},
	}).Parse(text)
}

// Render executes engine/name with data.
func Render(engine, name string, data any) (string, error) {
	src, _, err := Source(engine, name)
	if err != nil {
		return "", err
	}
	t, err := parse(name, src)
	if err != nil {
		return "", fmt.Errorf("%s/%s: %w", engine, name, err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("%s/%s: %w", engine, name, err)
	}
	return buf.String(), nil
}
