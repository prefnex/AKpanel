package services

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	sshJailBinDir   = "/usr/local/lib/akpanel/jailbin"
	sshJailShell    = "/usr/local/bin/akpanel-ssh-shell"
	sshJailGroup    = "akpanel-clients"
	sshdJailConf    = "/etc/ssh/sshd_config.d/akpanel-jail.conf"
	rmWrapperPath   = "/usr/local/lib/akpanel/jailbin/rm"
)

// EnsureSSHJail writes the restricted shell, command wrappers, and sshd match block.
func EnsureSSHJail() {
	_ = exec.Command("groupadd", "-f", sshJailGroup).Run()
	_ = os.MkdirAll(sshJailBinDir, 0755)
	_ = os.MkdirAll("/usr/local/bin", 0755)
	_ = os.MkdirAll("/etc/ssh/sshd_config.d", 0755)

	shell := `#!/bin/bash
# AKpanel jailed interactive shell — home only, restricted bash, curated PATH.
USER_NAME="${USER:-$(id -un)}"
HOME_DIR="$(getent passwd "$USER_NAME" | cut -d: -f6)"
if [ -z "$HOME_DIR" ] || [ ! -d "$HOME_DIR" ]; then
  echo "akpanel: home directory is not available"
  exit 1
fi
cd "$HOME_DIR" || exit 1
export HOME="$HOME_DIR"
export USER="$USER_NAME"
export LOGNAME="$USER_NAME"
export PATH=/usr/local/lib/akpanel/jailbin
export SHELL=/usr/local/bin/akpanel-ssh-shell
umask 022
# Restricted bash cannot cd out of $HOME and cannot change PATH.
exec /bin/bash --restricted -i
`
	_ = os.WriteFile(sshJailShell, []byte(shell), 0755)

	sshd := fmt.Sprintf(`# AKpanel client SSH jail
Match Group %s
    AllowTcpForwarding no
    X11Forwarding no
    PermitTunnel no
    GatewayPorts no
    PermitUserRC no
    ForceCommand %s
`, sshJailGroup, sshJailShell)
	_ = os.WriteFile(sshdJailConf, []byte(sshd), 0644)
	_ = exec.Command("sshd", "-t").Run()
	_ = exec.Command("systemctl", "reload", "ssh").Run()
	_ = exec.Command("systemctl", "reload", "sshd").Run()

	allow := []string{
		"ls", "dir", "cat", "more", "less", "head", "tail", "wc", "sort", "uniq", "cut", "tr",
		"grep", "egrep", "fgrep", "find", "pwd", "echo", "printf", "date", "clear", "id", "whoami",
		"nano", "vi", "vim", "touch", "mkdir", "cp", "mv", "ln", "chmod", "stat", "file", "du", "df",
		"tar", "gzip", "gunzip", "zip", "unzip", "git", "php", "php8.1", "php8.2", "php8.3", "php8.4",
		"composer", "mysql", "mysqldump", "wget", "curl", "rsync", "scp", "sftp", "python3", "node",
		"npm", "npx", "ping", "diff", "patch", "make", "basename", "dirname", "realpath", "md5sum",
		"sha256sum", "sleep", "env", "printenv",
	}
	for _, name := range allow {
		src, err := exec.LookPath(name)
		if err != nil {
			continue
		}
		dest := filepath.Join(sshJailBinDir, name)
		_ = os.Remove(dest)
		_ = os.Symlink(src, dest)
	}

	// Overwrite dangerous tools with wrappers (never symlink real rm/dd/sudo).
	writeJailWrapper("rm", rmWrapper)
	writeJailWrapper("rmdir", pathGuardWrapper("rmdir"))
	writeJailWrapper("mv", pathGuardWrapper("mv"))
	writeJailWrapper("chmod", pathGuardWrapper("chmod"))
	writeJailWrapper("chown", blockedCmd("chown"))
	writeJailWrapper("chgrp", blockedCmd("chgrp"))
	writeJailWrapper("dd", blockedCmd("dd"))
	writeJailWrapper("mkfs", blockedCmd("mkfs"))
	writeJailWrapper("fdisk", blockedCmd("fdisk"))
	writeJailWrapper("wipefs", blockedCmd("wipefs"))
	writeJailWrapper("mount", blockedCmd("mount"))
	writeJailWrapper("umount", blockedCmd("umount"))
	writeJailWrapper("sudo", blockedCmd("sudo"))
	writeJailWrapper("su", blockedCmd("su"))
	writeJailWrapper("passwd", blockedCmd("passwd"))
	writeJailWrapper("useradd", blockedCmd("useradd"))
	writeJailWrapper("userdel", blockedCmd("userdel"))
	writeJailWrapper("visudo", blockedCmd("visudo"))
	writeJailWrapper("systemctl", blockedCmd("systemctl"))
	writeJailWrapper("service", blockedCmd("service"))
	writeJailWrapper("shutdown", blockedCmd("shutdown"))
	writeJailWrapper("reboot", blockedCmd("reboot"))
	writeJailWrapper("iptables", blockedCmd("iptables"))
	writeJailWrapper("nft", blockedCmd("nft"))
	writeJailWrapper("ufw", blockedCmd("ufw"))
	writeJailWrapper("chroot", blockedCmd("chroot"))
	writeJailWrapper("nsenter", blockedCmd("nsenter"))
	writeJailWrapper("docker", blockedCmd("docker"))
	writeJailWrapper("kill", blockedCmd("kill"))
	writeJailWrapper("killall", blockedCmd("killall"))
	writeJailWrapper("pkill", blockedCmd("pkill"))
	writeJailWrapper("crontab", blockedCmd("crontab"))
	writeJailWrapper("bash", blockedCmd("bash"))
	writeJailWrapper("sh", blockedCmd("sh"))
	writeJailWrapper("dash", blockedCmd("dash"))
}

func writeJailWrapper(name, body string) {
	_ = os.WriteFile(filepath.Join(sshJailBinDir, name), []byte(body), 0755)
}

func blockedCmd(name string) string {
	return fmt.Sprintf("#!/bin/bash\necho \"akpanel: '%s' is not allowed in the hosting jail\" >&2\nexit 1\n", name)
}

func pathGuardWrapper(bin string) string {
	realBin, err := exec.LookPath(bin)
	if err != nil {
		return blockedCmd(bin)
	}
	return fmt.Sprintf(`#!/bin/bash
HOME_DIR="$(getent passwd "${USER:-$(id -un)}" | cut -d: -f6)"
deny() { echo "akpanel: path is outside your home jail" >&2; exit 1; }
for arg in "$@"; do
  case "$arg" in
    -*) continue ;;
  esac
  resolved="$(realpath -m -- "$arg" 2>/dev/null || echo "$arg")"
  case "$resolved" in
    /|/bin|/boot|/dev|/etc|/home|/lib|/lib64|/opt|/proc|/root|/run|/sbin|/sys|/usr|/var)
      deny ;;
  esac
  case "$resolved" in
    "$HOME_DIR"|"$HOME_DIR"/*) ;;
    *) deny ;;
  esac
done
exec %s "$@"
`, realBin)
}

const rmWrapper = `#!/bin/bash
HOME_DIR="$(getent passwd "${USER:-$(id -un)}" | cut -d: -f6)"
deny() { echo "akpanel: refusing dangerous rm ($*)" >&2; exit 1; }
[ -z "$HOME_DIR" ] && deny
for arg in "$@"; do
  case "$arg" in
    --no-preserve-root) deny ;;
    -*) continue ;;
  esac
  resolved="$(realpath -m -- "$arg" 2>/dev/null || echo "$arg")"
  case "$arg" in
    /|/*|/home|/home/*) ;;
  esac
  case "$resolved" in
    /|/bin|/boot|/dev|/etc|/home|/lib|/lib64|/opt|/proc|/root|/run|/sbin|/sys|/usr|/var|"$HOME_DIR"/..)
      deny ;;
  esac
  case "$resolved" in
    "$HOME_DIR"|"$HOME_DIR"/*) ;;
    *) deny ;;
  esac
done
exec /bin/rm --preserve-root --one-file-system "$@"
`

// ApplySSHJailToUser puts the Linux account in the jail group and jailed shell when SSH is enabled.
func ApplySSHJailToUser(username string, shellAccess bool) {
	EnsureSSHJail()
	if username == "" || username == "root" {
		return
	}
	_ = exec.Command("usermod", "-aG", sshJailGroup, username).Run()
	if shellAccess {
		_ = exec.Command("usermod", "-s", sshJailShell, username).Run()
	} else {
		_ = exec.Command("usermod", "-s", "/usr/sbin/nologin", username).Run()
	}
}

func jailSafeUsername(u string) bool {
	return u != "" && !strings.Contains(u, "/") && u != "root"
}
