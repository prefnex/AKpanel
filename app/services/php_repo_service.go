package services

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"goravel/app/paths"
)

// PHP package source policy.
//
// Multi-PHP comes from ondrej/php (Launchpad PPA on Ubuntu, packages.sury.org on Debian),
// but only when it publishes a build for THIS release. An entry for another release's
// suite (the old installer wrote "noble" everywhere) or with a stale key makes
// `apt-get update` fail for the whole system, which is how every PHP install broke. When
// the repo has no build we drop it and the distro's own PHP branch is what is available.

const (
	phpRepoList      = "/etc/apt/sources.list.d/akpanel-php.list"
	phpRepoKeyUbuntu = "/etc/apt/keyrings/akpanel-php.asc"
	phpRepoKeyDebian = "/etc/apt/keyrings/akpanel-php.gpg"
	ondrejPPABase    = "https://ppa.launchpadcontent.net/ondrej/php/ubuntu"
	suryBase         = "https://packages.sury.org/php"
	// Current PPA signing key, used only if the Launchpad API cannot be reached.
	ondrejPPAKeyFallback = "71DAEAAB4AD4CAB6"
)

var (
	phpPkgNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9.+-]{0,63}$`)
	phpRepoMu    sync.Mutex
)

// PHPRepoStatus describes where PHP packages come from on this server.
type PHPRepoStatus struct {
	OSID     string `json:"os_id"`
	Codename string `json:"codename"`
	Source   string `json:"source"` // "ondrej" | "sury" | "distro"
	Message  string `json:"message"`
}

func readOSRelease() (id, codename string) {
	b, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return "", ""
	}
	for _, line := range strings.Split(string(b), "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok {
			continue
		}
		v = strings.Trim(v, `"'`)
		switch k {
		case "ID":
			id = v
		case "VERSION_CODENAME":
			codename = v
		}
	}
	return id, codename
}

func httpGet(url string, timeout time.Duration) ([]byte, int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	return body, resp.StatusCode, err
}

// removeForeignPHPRepos deletes ondrej/sury entries that are not ours (add-apt-repository
// files, old installer files) so a wrong suite or missing key cannot break apt.
func removeForeignPHPRepos(logf func(string)) {
	for _, pattern := range []string{"/etc/apt/sources.list.d/*ondrej*", "/etc/apt/sources.list.d/*sury*"} {
		matches, _ := filepath.Glob(pattern)
		for _, m := range matches {
			if err := os.Remove(m); err == nil {
				logf("Removed stale PHP repository entry " + m)
			}
		}
	}
}

func ondrejPPAKeyURL() string {
	fp := ondrejPPAKeyFallback
	if body, code, err := httpGet("https://api.launchpad.net/1.0/~ondrej/+archive/ubuntu/php", 20*time.Second); err == nil && code == 200 {
		var meta struct {
			Fingerprint string `json:"signing_key_fingerprint"`
		}
		if json.Unmarshal(body, &meta) == nil && regexp.MustCompile(`^[0-9A-Fa-f]{16,40}$`).MatchString(meta.Fingerprint) {
			fp = meta.Fingerprint
		}
	}
	return "https://keyserver.ubuntu.com/pks/lookup?op=get&options=mr&search=0x" + fp
}

// aptUpdate runs apt-get update and returns its combined output.
func aptUpdate() (string, error) {
	cmd := exec.Command("apt-get", "update", "-y")
	cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// EnsurePHPRepository makes sure apt can be refreshed and, when the release is covered,
// points at ondrej/php with the correct suite and signing key. It always ends with a
// working `apt-get update` (dropping the repo if that is what breaks it).
func (p *PHPManagerService) EnsurePHPRepository(logf func(string)) PHPRepoStatus {
	if logf == nil {
		logf = func(string) {}
	}
	phpRepoMu.Lock()
	defer phpRepoMu.Unlock()

	id, codename := readOSRelease()
	st := PHPRepoStatus{OSID: id, Codename: codename, Source: "distro"}

	var base, keyPath, keyURL, source string
	switch id {
	case "ubuntu":
		base, keyPath, source = ondrejPPABase, phpRepoKeyUbuntu, "ondrej"
	case "debian":
		base, keyPath, keyURL, source = suryBase, phpRepoKeyDebian, suryBase+"/apt.gpg", "sury"
	}

	wantLine := ""
	if base != "" && codename != "" {
		wantLine = fmt.Sprintf("deb [signed-by=%s] %s %s main", keyPath, base, codename)
	}

	// Already configured correctly: just refresh.
	if cur, err := os.ReadFile(phpRepoList); err == nil && wantLine != "" && strings.TrimSpace(string(cur)) == wantLine {
		if _, err := os.Stat(keyPath); err == nil {
			removeForeignPHPRepos(logf)
			if out, err := aptUpdate(); err == nil {
				st.Source = source
				st.Message = fmt.Sprintf("Using %s for %s %s", base, id, codename)
				return st
			} else {
				logf("apt-get update failed with the PHP repository, re-checking it")
				logTail(logf, out)
			}
		}
	}

	removeForeignPHPRepos(logf)
	_ = os.Remove(phpRepoList)

	if wantLine == "" {
		st.Message = fmt.Sprintf("No multi-PHP repository for %q; using distro PHP packages", id)
	} else if _, code, err := httpGet(fmt.Sprintf("%s/dists/%s/Release", base, codename), 20*time.Second); err != nil || code != 200 {
		st.Message = fmt.Sprintf("%s has no packages for %s %s yet; only the distro PHP version can be installed", base, id, codename)
	} else {
		if id == "ubuntu" {
			keyURL = ondrejPPAKeyURL()
		}
		logf("Fetching PHP repository signing key")
		key, code, err := httpGet(keyURL, 30*time.Second)
		if err != nil || code != 200 || len(key) == 0 {
			st.Message = "Could not download the PHP repository signing key; using distro PHP packages"
		} else {
			_ = os.MkdirAll(filepath.Dir(keyPath), 0755)
			if err := os.WriteFile(keyPath, key, 0644); err != nil {
				st.Message = "Could not write the PHP repository key: " + err.Error()
			} else if err := os.WriteFile(phpRepoList, []byte(wantLine+"\n"), 0644); err != nil {
				st.Message = "Could not write the PHP repository entry: " + err.Error()
			} else {
				logf(fmt.Sprintf("Added %s (%s)", base, codename))
				st.Source = source
			}
		}
	}

	logf("Refreshing package lists (apt-get update)")
	if out, err := aptUpdate(); err != nil {
		if st.Source != "distro" {
			logf("apt-get update failed with the PHP repository; removing it")
			logTail(logf, out)
			_ = os.Remove(phpRepoList)
			st.Source = "distro"
			st.Message = "PHP repository rejected by apt; using distro PHP packages"
			if out2, err2 := aptUpdate(); err2 != nil {
				logTail(logf, out2)
			}
		} else {
			logTail(logf, out)
		}
	}
	if st.Source != "distro" {
		st.Message = fmt.Sprintf("Using %s for %s %s", base, id, codename)
	}
	return st
}

func logTail(logf func(string), out string) {
	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) > 8 {
		lines = lines[len(lines)-8:]
	}
	for _, l := range lines {
		if strings.TrimSpace(l) != "" {
			logf("  " + l)
		}
	}
}

// aptCandidates returns pkg -> available for each package (one apt-cache call).
func aptCandidates(pkgs []string) map[string]bool {
	res := make(map[string]bool, len(pkgs))
	if len(pkgs) == 0 {
		return res
	}
	out, _ := exec.Command("apt-cache", append([]string{"policy"}, pkgs...)...).Output()
	parseAptPolicy(string(out), res)
	return res
}

// parseAptPolicy fills res from `apt-cache policy` output (unknown packages print nothing).
func parseAptPolicy(out string, res map[string]bool) {
	var cur string
	for _, line := range strings.Split(out, "\n") {
		if !strings.HasPrefix(line, " ") && strings.HasSuffix(strings.TrimSpace(line), ":") {
			cur = strings.TrimSuffix(strings.TrimSpace(line), ":")
			continue
		}
		t := strings.TrimSpace(line)
		if cur != "" && strings.HasPrefix(t, "Candidate:") {
			c := strings.TrimSpace(strings.TrimPrefix(t, "Candidate:"))
			res[cur] = c != "" && c != "(none)"
		}
	}
}

// AvailablePHPVersions returns which supported versions apt can install right now.
func (p *PHPManagerService) AvailablePHPVersions() map[string]bool {
	vers := p.getSupportedVersions()
	pkgs := make([]string, 0, len(vers))
	for _, v := range vers {
		pkgs = append(pkgs, "php"+v+"-fpm")
	}
	cands := aptCandidates(pkgs)
	out := make(map[string]bool, len(vers))
	for _, v := range vers {
		out[v] = cands["php"+v+"-fpm"]
	}
	return out
}

// runStreaming runs a command and streams each output line into the task log.
func (p *PHPManagerService) runStreaming(taskID string, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
	pr, pw := io.Pipe()
	cmd.Stdout = pw
	cmd.Stderr = pw
	if err := cmd.Start(); err != nil {
		_ = pw.Close()
		return err
	}
	done := make(chan struct{})
	go func() {
		sc := bufio.NewScanner(pr)
		sc.Buffer(make([]byte, 64*1024), 1024*1024)
		for sc.Scan() {
			if l := strings.TrimRight(sc.Text(), "\r"); strings.TrimSpace(l) != "" {
				p.appendLog(taskID, "  "+l)
			}
		}
		_, _ = io.Copy(io.Discard, pr)
		close(done)
	}()
	err := cmd.Wait()
	_ = pw.Close()
	<-done
	return err
}

var aptInstallArgs = []string{"install", "-y", "-o", "Dpkg::Options::=--force-confdef", "-o", "Dpkg::Options::=--force-confold"}

// DefaultPHPInstallPackages is what "Install PHP x.y" pulls when no list is given.
var DefaultPHPInstallPackages = []string{"cli", "fpm", "cgi", "common", "mysql", "curl", "mbstring", "xml", "zip", "gd", "intl", "bcmath", "sqlite3", "opcache"}

// LiveInstallRequest is a validated install job from the PHP pages.
type LiveInstallRequest struct {
	Type     string   // version | extension | addon | ffmpeg
	Version  string   // "8.3"
	Name     string   // extension / addon name
	Packages []string // package suffixes for Type=version
}

// StartLiveInstall validates the request and starts it as a background task.
func (p *PHPManagerService) StartLiveInstall(req LiveInstallRequest) (taskID, title string, err error) {
	needsVersion := req.Type != "ffmpeg"
	if needsVersion && !paths.IsPHPVersionString(req.Version) {
		return "", "", fmt.Errorf("invalid PHP version %q", req.Version)
	}
	switch req.Type {
	case "version":
		title = fmt.Sprintf("PHP %s Installation", req.Version)
		if len(req.Packages) == 0 {
			req.Packages = DefaultPHPInstallPackages
		}
		for _, pk := range req.Packages {
			if !phpPkgNameRe.MatchString(pk) {
				return "", "", fmt.Errorf("invalid package name %q", pk)
			}
		}
	case "extension", "addon":
		req.Name = strings.ToLower(strings.TrimSpace(req.Name))
		if !phpPkgNameRe.MatchString(req.Name) {
			return "", "", fmt.Errorf("invalid extension name %q", req.Name)
		}
		if req.Type == "extension" {
			title = fmt.Sprintf("Extension '%s' for PHP %s", req.Name, req.Version)
		} else {
			title = fmt.Sprintf("PHP Addon '%s'", req.Name)
		}
	case "ffmpeg":
		title = "FFMPEG & Media Transcoding Engine"
	default:
		return "", "", fmt.Errorf("invalid type")
	}

	taskID = p.newTask(title)
	go p.runInstallTask(taskID, req)
	return taskID, title, nil
}

func (p *PHPManagerService) newTask(title string) string {
	taskID := fmt.Sprintf("task_%d", time.Now().UnixNano())
	p.tasksMutex.Lock()
	p.tasks[taskID] = &LiveInstallTask{
		ID:        taskID,
		Title:     title,
		Status:    "running",
		Progress:  5,
		Logs:      []string{fmt.Sprintf("🚀 [1/4] Starting %s...", title)},
		StartTime: time.Now(),
	}
	p.tasksMutex.Unlock()
	return taskID
}

func (p *PHPManagerService) failTask(taskID, msg string) {
	p.appendLog(taskID, "❌ "+msg)
	p.setTaskStatus(taskID, "failed", 100)
}

func (p *PHPManagerService) runInstallTask(taskID string, req LiveInstallRequest) {
	logf := func(s string) { p.appendLog(taskID, "  "+s) }

	if req.Type == "addon" && req.Name == "ioncube" {
		if err := p.installIonCube(taskID, req.Version); err != nil {
			p.failTask(taskID, err.Error())
			return
		}
		p.appendLog(taskID, "✅ [4/4] IonCube Loader enabled for PHP "+req.Version)
		p.setTaskStatus(taskID, "completed", 100)
		return
	}

	p.appendLog(taskID, "📦 [2/4] Checking PHP package repository...")
	p.setProgress(taskID, 15)
	st := p.EnsurePHPRepository(logf)
	if st.Message != "" {
		p.appendLog(taskID, "  "+st.Message)
	}
	p.setProgress(taskID, 35)

	var pkgs []string
	switch req.Type {
	case "version":
		fpm := "php" + req.Version + "-fpm"
		want := make([]string, 0, len(req.Packages))
		for _, s := range req.Packages {
			want = append(want, fmt.Sprintf("php%s-%s", req.Version, s))
		}
		cands := aptCandidates(append(want, fpm))
		if !cands[fpm] && !cands["php"+req.Version+"-cli"] {
			var avail []string
			for v, ok := range p.AvailablePHPVersions() {
				if ok {
					avail = append(avail, v)
				}
			}
			paths.SortPHPVersionsDesc(avail)
			msg := fmt.Sprintf("PHP %s is not available for %s %s.", req.Version, st.OSID, st.Codename)
			if len(avail) > 0 {
				msg += " Installable versions: " + strings.Join(avail, ", ")
			}
			p.failTask(taskID, msg)
			return
		}
		for _, pk := range want {
			if cands[pk] {
				pkgs = append(pkgs, pk)
			} else {
				p.appendLog(taskID, "  ⚠️ "+pk+" is not available for this PHP version, skipped")
			}
		}
	case "extension", "addon":
		pk := fmt.Sprintf("php%s-%s", req.Version, req.Name)
		generic := "php-" + req.Name // some PECL builds only ship as php-<name>
		cands := aptCandidates([]string{pk, generic})
		switch {
		case cands[pk]:
			pkgs = []string{pk}
		case cands[generic]:
			pkgs = []string{generic}
		default:
			p.failTask(taskID, fmt.Sprintf("No package %s available for %s %s", pk, st.OSID, st.Codename))
			return
		}
	case "ffmpeg":
		pkgs = []string{"ffmpeg"}
	}

	p.appendLog(taskID, "⚙️ [3/4] Installing: "+strings.Join(pkgs, " "))
	p.setProgress(taskID, 45)
	if err := p.runStreaming(taskID, "apt-get", append(append([]string{}, aptInstallArgs...), pkgs...)...); err != nil {
		p.failTask(taskID, fmt.Sprintf("apt-get install failed: %v", err))
		return
	}
	p.setProgress(taskID, 90)

	if req.Version != "" {
		unit := fmt.Sprintf("php%s-fpm", req.Version)
		if req.Type == "version" {
			_ = exec.Command("systemctl", "enable", "--now", unit).Run()
			p.EnsureCLIDefault()
		} else {
			_ = exec.Command("systemctl", "restart", unit).Run()
		}
	}
	p.appendLog(taskID, "✅ [4/4] Process completed successfully! Services reloaded.")
	p.setTaskStatus(taskID, "completed", 100)
}

// installIonCube downloads the vendor loader bundle and enables the loader matching version.
// IonCube is not packaged for apt, so it is installed as a zend_extension that loads first.
func (p *PHPManagerService) installIonCube(taskID, version string) error {
	if !paths.PHPCLIInstalled(version) {
		return fmt.Errorf("PHP %s is not installed", version)
	}
	arch := "x86-64"
	if out, _ := exec.Command("uname", "-m").Output(); strings.Contains(string(out), "aarch64") {
		arch = "aarch64"
	}
	url := fmt.Sprintf("https://downloads.ioncube.com/loader_downloads/ioncube_loaders_lin_%s.tar.gz", arch)
	p.appendLog(taskID, "📦 [2/4] Downloading "+url)
	p.setProgress(taskID, 20)
	body, code, err := httpGet(url, 120*time.Second)
	if err != nil || code != 200 {
		return fmt.Errorf("download failed (HTTP %d): %v", code, err)
	}
	dir, err := os.MkdirTemp("", "akpanel-ioncube-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	tarPath := filepath.Join(dir, "ioncube.tar.gz")
	if err := os.WriteFile(tarPath, body, 0600); err != nil {
		return err
	}
	if out, err := exec.Command("tar", "-xzf", tarPath, "-C", dir).CombinedOutput(); err != nil {
		return fmt.Errorf("extract failed: %s", lastLines(string(out), 3))
	}
	src := filepath.Join(dir, "ioncube", fmt.Sprintf("ioncube_loader_lin_%s.so", version))
	if _, err := os.Stat(src); err != nil {
		return fmt.Errorf("IonCube has no loader for PHP %s yet", version)
	}
	p.setProgress(taskID, 60)

	extDirOut, err := exec.Command("/usr/bin/php"+version, "-r", "echo ini_get('extension_dir');").Output()
	extDir := strings.TrimSpace(string(extDirOut))
	if err != nil || extDir == "" || !filepath.IsAbs(extDir) {
		return fmt.Errorf("cannot find the PHP %s extension directory", version)
	}
	dst := filepath.Join(extDir, "ioncube_loader.so")
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	if err := os.WriteFile(dst, data, 0644); err != nil {
		return err
	}
	p.appendLog(taskID, "⚙️ [3/4] Installed "+dst)
	ini := fmt.Sprintf("; priority=00\n; Managed by AKpanel\nzend_extension=%s\n", dst)
	if err := os.WriteFile(fmt.Sprintf("/etc/php/%s/mods-available/ioncube.ini", version), []byte(ini), 0644); err != nil {
		return err
	}
	if out, err := exec.Command("phpenmod", "-v", version, "ioncube").CombinedOutput(); err != nil {
		return fmt.Errorf("phpenmod failed: %s", lastLines(string(out), 3))
	}
	if out, err := exec.Command("/usr/bin/php"+version, "-v").CombinedOutput(); err != nil || !strings.Contains(string(out), "ionCube") {
		_ = exec.Command("phpdismod", "-v", version, "ioncube").Run()
		return fmt.Errorf("PHP %s did not load the IonCube loader, disabled again: %s", version, lastLines(string(out), 3))
	}
	reloadFPM(version)
	return nil
}
