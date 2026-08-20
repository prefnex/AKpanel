package dbengines

import (
	"os/exec"
	"strings"
)

// EngineInfo describes a detected database engine on the host.
type EngineInfo struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	Status    string `json:"status"`
	Available bool   `json:"available"`
}

func checkBinary(bin string) bool {
	_, err := exec.LookPath(bin)
	return err == nil
}

func serviceRunning(names ...string) bool {
	for _, name := range names {
		cmd := exec.Command("service", name, "status")
		if out, err := cmd.CombinedOutput(); err == nil {
			s := strings.ToLower(string(out))
			if strings.Contains(s, "running") || strings.Contains(s, "active") {
				return true
			}
		}
		if exec.Command("pgrep", "-x", name).Run() == nil {
			return true
		}
	}
	return false
}

// DetectAvailable returns installed and running database engines.
func DetectAvailable() []EngineInfo {
	var out []EngineInfo

	if checkBinary("mysql") || checkBinary("mariadb") {
		status := "stopped"
		if serviceRunning("mariadb", "mysql", "mysqld") {
			status = "running"
		}
		out = append(out, EngineInfo{Name: "mysql", Status: status, Available: status == "running"})
	}

	if checkBinary("psql") {
		status := "stopped"
		if serviceRunning("postgresql", "postgres") {
			status = "running"
		}
		out = append(out, EngineInfo{Name: "postgresql", Status: status, Available: status == "running"})
	}

	if checkBinary("mongod") || checkBinary("mongosh") {
		status := "stopped"
		if serviceRunning("mongod", "mongodb") {
			status = "running"
		}
		out = append(out, EngineInfo{Name: "mongodb", Status: status, Available: status == "running"})
	}

	if checkBinary("redis-server") || checkBinary("redis-cli") {
		status := "stopped"
		if serviceRunning("redis-server", "redis") {
			status = "running"
		}
		out = append(out, EngineInfo{Name: "redis", Status: status, Available: status == "running"})
	}

	return out
}
