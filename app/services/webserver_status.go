package services

import (
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"goravel/app/paths"
)

// Web server status (CWP shows netstat on the mode page and Apache version + modules in its
// Apache builder): what each daemon runs, where it listens, and Apache's modules and live
// mod_status figures. Everything here is read from the system; nothing is made up.

// DaemonStatus is one web daemon.
type DaemonStatus struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Unit      string   `json:"unit"`
	Installed bool     `json:"installed"`
	Active    bool     `json:"active"`
	Version   string   `json:"version"`
	Listen    []string `json:"listen"`
	Processes int      `json:"processes"`
}

// ApacheInfo is Apache's build and modules, plus mod_status when it answers.
type ApacheInfo struct {
	Version string            `json:"version"`
	MPM     string            `json:"mpm"`
	Modules []string          `json:"modules"`
	Status  map[string]string `json:"status,omitempty"` // mod_status ?auto keys
}

// WebServerStatus is the whole page.
type WebServerStatus struct {
	Mode    string         `json:"mode"`
	Daemons []DaemonStatus `json:"daemons"`
	Apache  *ApacheInfo    `json:"apache,omitempty"`
}

func cmdOut(name string, args ...string) string {
	out, _ := exec.Command(name, args...).CombinedOutput()
	return strings.TrimSpace(string(out))
}

var ssProcRe = regexp.MustCompile(`users:\(\("([^"]+)"`)

// listeners maps process name → listening addresses (from ss -ltnpH).
func listeners() map[string][]string {
	out := cmdOut("ss", "-ltnpH")
	m := map[string][]string{}
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) < 4 {
			continue
		}
		pm := ssProcRe.FindStringSubmatch(line)
		if pm == nil {
			continue
		}
		name := pm[1]
		addr := f[3]
		found := false
		for _, a := range m[name] {
			if a == addr {
				found = true
			}
		}
		if !found {
			m[name] = append(m[name], addr)
		}
	}
	for k := range m {
		sort.Strings(m[k])
	}
	return m
}

func processCount(pattern string) int {
	out := cmdOut("pgrep", "-c", "-f", pattern)
	n, _ := strconv.Atoi(strings.TrimSpace(out))
	return n
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}

// GetWebServerStatus collects the daemons' state.
func GetWebServerStatus() WebServerStatus {
	ls := listeners()
	st := WebServerStatus{Mode: string(CurrentMode())}

	add := func(id, title, unit, bin, proc, version string, listenNames ...string) {
		_, err := exec.LookPath(bin)
		d := DaemonStatus{ID: id, Title: title, Unit: unit, Installed: err == nil, Listen: []string{}}
		if d.Installed {
			d.Active = unitActive(unit)
			d.Version = version
			for _, n := range listenNames {
				d.Listen = append(d.Listen, ls[n]...)
			}
			d.Processes = processCount(proc)
		}
		st.Daemons = append(st.Daemons, d)
	}

	nginxV := strings.TrimPrefix(cmdOut("nginx", "-v"), "nginx version: ")
	add("nginx", "Nginx", "nginx", "nginx", "nginx: (master|worker)", nginxV, "nginx")

	apacheV := ""
	if v := cmdOut("apache2", "-v"); v != "" {
		apacheV = strings.TrimPrefix(firstLine(v), "Server version: ")
	}
	add("apache", "Apache", "apache2", "apache2ctl", "/usr/sbin/apache2", apacheV, "apache2")

	varnishV := ""
	if v := cmdOut("varnishd", "-V"); v != "" {
		varnishV = firstLine(v)
	}
	add("varnish", "Varnish", "varnish", "varnishd", "varnishd", varnishV, "varnishd", "cache-main")

	fpms, _ := filepath.Glob("/usr/sbin/php-fpm*")
	sort.Strings(fpms)
	for _, bin := range fpms {
		ver := strings.TrimPrefix(filepath.Base(bin), "php-fpm")
		if !paths.IsPHPVersionString(ver) {
			continue
		}
		v := firstLine(cmdOut(bin, "-v"))
		d := DaemonStatus{ID: "php-" + ver, Title: "PHP-FPM " + ver, Unit: "php" + ver + "-fpm", Installed: true, Listen: []string{}}
		d.Active = unitActive(d.Unit)
		d.Version = v
		if master := strings.Fields(cmdOut("pgrep", "-f", "php-fpm: master process \\(/etc/php/"+ver+"/")); len(master) > 0 {
			n, _ := strconv.Atoi(cmdOut("pgrep", "-c", "-P", master[0]))
			d.Processes = n + 1
		}
		socks, _ := filepath.Glob("/run/php/php" + ver + "-fpm*.sock")
		for _, s := range socks {
			d.Listen = append(d.Listen, "unix:"+s)
		}
		st.Daemons = append(st.Daemons, d)
	}

	if apacheInstalled() {
		st.Apache = apacheInfo()
	}
	return st
}

func apacheInfo() *ApacheInfo {
	info := &ApacheInfo{Modules: []string{}}
	if v := cmdOut("apache2", "-v"); v != "" {
		info.Version = strings.TrimPrefix(firstLine(v), "Server version: ")
	}
	for _, l := range strings.Split(cmdOut("apache2ctl", "-V"), "\n") {
		if strings.HasPrefix(strings.TrimSpace(l), "Server MPM:") {
			info.MPM = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(l), "Server MPM:"))
		}
	}
	for _, l := range strings.Split(cmdOut("apache2ctl", "-M"), "\n") {
		l = strings.TrimSpace(l)
		if strings.HasSuffix(l, ")") && strings.Contains(l, "_module") {
			info.Modules = append(info.Modules, strings.Fields(l)[0])
		}
	}
	sort.Strings(info.Modules)

	// mod_status, when enabled and reachable on loopback.
	port := "8081"
	if CurrentMode() == "apache" {
		port = "80"
	}
	out, err := exec.Command("curl", "-s", "--max-time", "2", "http://127.0.0.1:"+port+"/server-status?auto").Output()
	if err == nil && strings.Contains(string(out), "Scoreboard:") {
		info.Status = map[string]string{}
		for _, l := range strings.Split(string(out), "\n") {
			if k, v, ok := strings.Cut(l, ":"); ok {
				info.Status[strings.TrimSpace(k)] = strings.TrimSpace(v)
			}
		}
	}
	return info
}
