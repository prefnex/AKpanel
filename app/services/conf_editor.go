package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"unicode/utf8"
)

// Conf editor (CWP's WebServers_conf_editor): browse and edit the real configuration
// directories of nginx, Apache, Varnish and PHP-FPM. Every write is tested with the daemon's
// own checker before it is kept; a failing test restores the previous file.

// ConfRoot is one browsable tree.
type ConfRoot struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Path  string `json:"path"`
}

func confRoots() []ConfRoot {
	roots := []ConfRoot{
		{"nginx", "Nginx", "/etc/nginx"},
		{"apache", "Apache", "/etc/apache2"},
		{"varnish", "Varnish", "/etc/varnish"},
	}
	versions, _ := filepath.Glob("/etc/php/*/fpm")
	sort.Strings(versions)
	for _, v := range versions {
		ver := filepath.Base(filepath.Dir(v))
		roots = append(roots, ConfRoot{"php-" + ver, "PHP-FPM " + ver, v})
	}
	out := roots[:0]
	for _, r := range roots {
		if st, err := os.Stat(r.Path); err == nil && st.IsDir() {
			out = append(out, r)
		}
	}
	return out
}

// ConfRoots lists the trees available on this server.
func ConfRoots() []ConfRoot { return confRoots() }

func findRoot(id string) (ConfRoot, error) {
	for _, r := range confRoots() {
		if r.ID == id {
			return r, nil
		}
	}
	return ConfRoot{}, fmt.Errorf("unknown config tree %q", id)
}

// resolveConfPath maps (root, relative path) to an absolute path that stays inside the root,
// following symlinks (sites-enabled → sites-available is fine, /etc/shadow is not).
func resolveConfPath(rootID, rel string) (ConfRoot, string, error) {
	root, err := findRoot(rootID)
	if err != nil {
		return root, "", err
	}
	if strings.Contains(rel, "\x00") {
		return root, "", fmt.Errorf("invalid path")
	}
	for _, seg := range strings.Split(rel, "/") {
		if seg == ".." {
			return root, "", fmt.Errorf("invalid path")
		}
	}
	abs := filepath.Join(root.Path, filepath.Clean("/"+rel))
	if abs != root.Path && !strings.HasPrefix(abs, root.Path+"/") {
		return root, "", fmt.Errorf("invalid path")
	}
	// Resolve the deepest existing ancestor and check it is still inside the root.
	for p := abs; ; p = filepath.Dir(p) {
		if real, err := filepath.EvalSymlinks(p); err == nil {
			if real != root.Path && !strings.HasPrefix(real, root.Path+"/") {
				return root, "", fmt.Errorf("%s points outside %s", rel, root.Path)
			}
			break
		}
		if p == root.Path || p == "/" {
			break
		}
	}
	return root, abs, nil
}

// ConfEntry is one file or directory in a listing.
type ConfEntry struct {
	Name     string `json:"name"`
	Path     string `json:"path"` // relative to the root
	Dir      bool   `json:"dir"`
	Size     int64  `json:"size"`
	Modified string `json:"modified"`
	Link     string `json:"link,omitempty"`    // symlink target
	Managed  bool   `json:"managed,omitempty"` // written by AKpanel (edits are overwritten)
}

// ConfListing is a directory's content.
type ConfListing struct {
	Root    ConfRoot    `json:"root"`
	Dir     string      `json:"dir"`
	Entries []ConfEntry `json:"entries"`
}

func isManaged(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()
	buf := make([]byte, 512)
	n, _ := f.Read(buf)
	return strings.Contains(string(buf[:n]), "Managed by AKpanel")
}

// ListConfDir lists one directory of a tree.
func ListConfDir(rootID, rel string) (ConfListing, error) {
	root, abs, err := resolveConfPath(rootID, rel)
	if err != nil {
		return ConfListing{}, err
	}
	ents, err := os.ReadDir(abs)
	if err != nil {
		return ConfListing{}, err
	}
	relDir := strings.TrimPrefix(strings.TrimPrefix(abs, root.Path), "/")
	out := ConfListing{Root: root, Dir: relDir, Entries: []ConfEntry{}}
	for _, e := range ents {
		p := filepath.Join(abs, e.Name())
		st, err := os.Stat(p) // follows links
		if err != nil {
			continue
		}
		ce := ConfEntry{Name: e.Name(), Path: strings.TrimPrefix(filepath.Join(relDir, e.Name()), "/"), Dir: st.IsDir(),
			Size: st.Size(), Modified: st.ModTime().Format("2006-01-02 15:04")}
		if e.Type()&os.ModeSymlink != 0 {
			ce.Link, _ = os.Readlink(p)
		}
		if !ce.Dir {
			ce.Managed = isManaged(p)
		}
		out.Entries = append(out.Entries, ce)
	}
	sort.Slice(out.Entries, func(i, j int) bool {
		if out.Entries[i].Dir != out.Entries[j].Dir {
			return out.Entries[i].Dir
		}
		return out.Entries[i].Name < out.Entries[j].Name
	})
	return out, nil
}

const confMaxBytes = 1 << 20

// ConfFile is one file's content for the editor.
type ConfFile struct {
	Root    string `json:"root"`
	Path    string `json:"path"`
	Abs     string `json:"abs"`
	Content string `json:"content"`
	Managed bool   `json:"managed"`
	Link    string `json:"link,omitempty"`
}

// ReadConfFile returns a text file of a tree.
func ReadConfFile(rootID, rel string) (ConfFile, error) {
	_, abs, err := resolveConfPath(rootID, rel)
	if err != nil {
		return ConfFile{}, err
	}
	st, err := os.Stat(abs)
	if err != nil {
		return ConfFile{}, err
	}
	if st.IsDir() {
		return ConfFile{}, fmt.Errorf("%s is a directory", rel)
	}
	if st.Size() > confMaxBytes {
		return ConfFile{}, fmt.Errorf("%s is larger than 1 MB", rel)
	}
	b, err := os.ReadFile(abs)
	if err != nil {
		return ConfFile{}, err
	}
	if !utf8.Valid(b) {
		return ConfFile{}, fmt.Errorf("%s is not a text file", rel)
	}
	f := ConfFile{Root: rootID, Path: rel, Abs: abs, Content: string(b), Managed: isManaged(abs)}
	if l, err := os.Readlink(abs); err == nil {
		f.Link = l
	}
	return f, nil
}

var confFileName = regexp.MustCompile(`^[A-Za-z0-9._-]{1,128}$`)

// testAndReloadRoot runs the tree's checker and reloads the daemon when it passes.
func testAndReloadRoot(rootID string) error {
	switch {
	case rootID == "nginx":
		if !nginxInstalled() {
			return nil
		}
		if err := testNginx(); err != nil {
			return err
		}
		if unitActive("nginx") {
			return reloadUnit("nginx")
		}
	case rootID == "apache":
		if !apacheInstalled() {
			return nil
		}
		if err := testApache(); err != nil {
			return err
		}
		if unitActive("apache2") {
			return reloadUnit("apache2")
		}
	case rootID == "varnish":
		if !varnishInstalled() {
			return nil
		}
		if err := testVarnish(); err != nil {
			return err
		}
		if unitActive("varnish") {
			return reloadUnit("varnish")
		}
	case strings.HasPrefix(rootID, "php-"):
		ver := strings.TrimPrefix(rootID, "php-")
		if err := testFPM(ver); err != nil {
			return err
		}
		if unitActive("php" + ver + "-fpm") {
			return NewPHPManagerService().RestartFPM(ver)
		}
	}
	return nil
}

// One edit at a time: a test must see only its own change.
var confEditMu sync.Mutex

func lockConf()   { confEditMu.Lock() }
func unlockConf() { confEditMu.Unlock() }

// SaveConfFile writes (or creates) a file, tests the daemon and reloads it; a failing test
// restores the previous content (or removes the new file).
func SaveConfFile(rootID, rel, content string, create bool) error {
	if len(content) > confMaxBytes {
		return fmt.Errorf("content is larger than 1 MB")
	}
	if !utf8.ValidString(content) {
		return fmt.Errorf("content is not valid text")
	}
	_, abs, err := resolveConfPath(rootID, rel)
	if err != nil {
		return err
	}
	if !confFileName.MatchString(filepath.Base(abs)) {
		return fmt.Errorf("file names may only use letters, digits, '.', '_' and '-'")
	}
	lockConf()
	defer unlockConf()

	prev, readErr := os.ReadFile(abs)
	existed := readErr == nil
	if create && existed {
		return fmt.Errorf("%s already exists", rel)
	}
	if !create && !existed {
		return fmt.Errorf("%s does not exist", rel)
	}
	if st, err := os.Stat(filepath.Dir(abs)); err != nil || !st.IsDir() {
		return fmt.Errorf("folder %s does not exist", filepath.Dir(rel))
	}
	mode := os.FileMode(0644)
	if st, err := os.Stat(abs); err == nil {
		mode = st.Mode().Perm()
	}
	if err := os.WriteFile(abs, []byte(content), mode); err != nil {
		return err
	}
	if err := testAndReloadRoot(rootID); err != nil {
		if existed {
			_ = os.WriteFile(abs, prev, mode)
		} else {
			_ = os.Remove(abs)
		}
		_ = testAndReloadRoot(rootID)
		return fmt.Errorf("not saved: %w", err)
	}
	return nil
}

// DeleteConfFile removes a file (never a directory); restored if the daemon test fails.
func DeleteConfFile(rootID, rel string) error {
	_, abs, err := resolveConfPath(rootID, rel)
	if err != nil {
		return err
	}
	lockConf()
	defer unlockConf()
	lst, err := os.Lstat(abs)
	if err != nil {
		return err
	}
	if lst.IsDir() {
		return fmt.Errorf("folders cannot be deleted here")
	}
	var prev []byte
	link := ""
	if lst.Mode()&os.ModeSymlink != 0 {
		link, _ = os.Readlink(abs)
	} else {
		prev, _ = os.ReadFile(abs)
	}
	if err := os.Remove(abs); err != nil {
		return err
	}
	if err := testAndReloadRoot(rootID); err != nil {
		if link != "" {
			_ = os.Symlink(link, abs)
		} else {
			_ = os.WriteFile(abs, prev, lst.Mode().Perm())
		}
		_ = testAndReloadRoot(rootID)
		return fmt.Errorf("not deleted: %w", err)
	}
	return nil
}

// TestConfRoot runs a tree's checker without changing anything.
func TestConfRoot(rootID string) (string, error) {
	var out []byte
	var err error
	switch {
	case rootID == "nginx":
		out, err = exec.Command("nginx", "-t").CombinedOutput()
	case rootID == "apache":
		out, err = exec.Command("apache2ctl", "configtest").CombinedOutput()
	case rootID == "varnish":
		out, err = exec.Command("varnishd", "-C", "-f", varnishVCL).CombinedOutput()
		if err == nil {
			out = []byte("VCL compiled successfully")
		}
	case strings.HasPrefix(rootID, "php-"):
		bin := fpmBinary(strings.TrimPrefix(rootID, "php-"))
		if bin == "" {
			return "", fmt.Errorf("php-fpm binary not found")
		}
		out, err = exec.Command(bin, "-t").CombinedOutput()
	default:
		return "", fmt.Errorf("unknown config tree %q", rootID)
	}
	return strings.TrimSpace(lastLines(string(out), 20)), err
}
