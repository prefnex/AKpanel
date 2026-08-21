package services

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	sshJailBinDir = "/usr/local/lib/akpanel/jailbin"
	sshJailShell  = "/usr/local/bin/akpanel-ssh-shell"
	sshJailGroup  = "akpanel-clients"
	sshdJailConf  = "/etc/ssh/sshd_config.d/akpanel-jail.conf"
)

var jailWrapped = map[string]bool{
	"rm": true, "rmdir": true, "mv": true, "chmod": true, "chown": true, "chgrp": true,
	"dd": true, "mkfs": true, "fdisk": true, "wipefs": true, "mount": true, "umount": true,
	"sudo": true, "su": true, "passwd": true, "useradd": true, "userdel": true, "visudo": true,
	"systemctl": true, "service": true, "shutdown": true, "reboot": true,
	"iptables": true, "nft": true, "ufw": true, "chroot": true, "nsenter": true, "docker": true,
	"kill": true, "killall": true, "pkill": true, "crontab": true,
}

// EnsureSSHJail writes the restricted shell, command wrappers, and sshd match block.
// Wrappers live only under jailbin — never overwrite /usr/bin via symlink follow.
func EnsureSSHJail() {
	restoreHijackedCoreutils()

	_ = exec.Command("groupadd", "-f", sshJailGroup).Run()
	_ = os.MkdirAll(sshJailBinDir, 0755)
	_ = os.MkdirAll("/usr/local/bin", 0755)
	_ = os.MkdirAll("/etc/ssh/sshd_config.d", 0755)

	shell := `#!/bin/bash
# AKpanel jailed login: interactive rbash OR SFTP. Wrappers live only in jailbin.
USER_NAME="${USER:-$(id -un 2>/dev/null)}"
HOME_DIR="$(getent passwd "$USER_NAME" 2>/dev/null | cut -d: -f6)"
if [ -z "$HOME_DIR" ] || [ ! -d "$HOME_DIR" ]; then
  echo "akpanel: home directory is not available" >&2
  exit 1
fi
cd "$HOME_DIR" || exit 1
export HOME="$HOME_DIR"
export USER="$USER_NAME"
export LOGNAME="$USER_NAME"
export PATH=/usr/local/lib/akpanel/jailbin
export SHELL=/usr/local/bin/akpanel-ssh-shell
umask 022

sftp_bin=""
for cand in /usr/lib/openssh/sftp-server /usr/libexec/openssh/sftp-server /usr/lib/ssh/sftp-server; do
  [ -x "$cand" ] && sftp_bin="$cand" && break
done

orig="${SSH_ORIGINAL_COMMAND:-}"
if [ -n "$orig" ]; then
  case "$orig" in
    internal-sftp*|sftp-server*|/usr/lib/openssh/sftp-server*|/usr/libexec/openssh/sftp-server*|/usr/lib/ssh/sftp-server*)
      if [ -n "$sftp_bin" ]; then
        exec "$sftp_bin" -d "$HOME_DIR"
      fi
      echo "akpanel: sftp-server is not installed" >&2
      exit 1
      ;;
    scp\ -t*|scp\ -f*)
      echo "akpanel: use SFTP for file transfer" >&2
      exit 1
      ;;
    *)
      echo "akpanel: remote command is not allowed" >&2
      exit 1
      ;;
  esac
fi

# Skip /etc/profile and ~/.bashrc (they need /usr/bin on PATH).
exec /bin/bash --restricted --noprofile --norc -i
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
		"groups", "uname", "true", "false", "which", "tty", "basename", "dirname", "realpath",
		"nano", "vi", "vim", "touch", "mkdir", "cp", "stat", "file", "du", "df",
		"tar", "gzip", "gunzip", "zip", "unzip", "git", "php", "php8.1", "php8.2", "php8.3", "php8.4",
		"composer", "mysql", "mysqldump", "wget", "curl", "rsync", "scp", "sftp", "python3", "node",
		"npm", "npx", "ping", "diff", "patch", "make", "md5sum",
		"sha256sum", "sleep", "env", "printenv", "getent", "lesspipe", "dircolors",
	}
	for _, name := range allow {
		if jailWrapped[name] {
			continue
		}
		src := realSystemBin(name)
		if src == "" {
			continue
		}
		dest := filepath.Join(sshJailBinDir, name)
		_ = os.Remove(dest)
		_ = os.Symlink(src, dest)
	}

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
}

func restoreHijackedCoreutils() {
	markers := [][]byte{
		[]byte("akpanel: path is outside your home jail"),
		[]byte("akpanel: refusing dangerous rm"),
		[]byte("not allowed in the hosting jail"),
	}
	bins := []string{
		"/usr/bin/chmod", "/bin/chmod", "/usr/bin/rm", "/bin/rm",
		"/usr/bin/mv", "/bin/mv", "/usr/bin/chown", "/bin/chown",
		"/usr/bin/chgrp", "/usr/bin/rmdir", "/bin/rmdir",
	}
	hijacked := false
	for _, p := range bins {
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		for _, m := range markers {
			if bytes.Contains(b, m) {
				hijacked = true
				break
			}
		}
	}
	if !hijacked {
		return
	}
	_ = exec.Command("apt-get", "install", "-y", "-o", "Dpkg::Options::=--force-confdef", "--reinstall", "coreutils").Run()
}

func writeJailWrapper(name, body string) {
	dest := filepath.Join(sshJailBinDir, name)
	_ = os.Remove(dest)
	_ = os.WriteFile(dest, []byte(body), 0755)
}

func blockedCmd(name string) string {
	return fmt.Sprintf("#!/bin/bash\necho \"akpanel: '%s' is not allowed in the hosting jail\" >&2\nexit 1\n", name)
}

func realSystemBin(name string) string {
	for _, p := range []string{"/usr/bin/" + name, "/bin/" + name, "/usr/sbin/" + name} {
		st, err := os.Lstat(p)
		if err != nil {
			continue
		}
		target := p
		if st.Mode()&os.ModeSymlink != 0 {
			resolved, err := filepath.EvalSymlinks(p)
			if err != nil {
				continue
			}
			target = resolved
		}
		b, err := os.ReadFile(target)
		if err != nil {
			continue
		}
		if bytes.HasPrefix(b, []byte("#!")) && bytes.Contains(b, []byte("akpanel:")) {
			continue
		}
		return target
	}
	return ""
}

func pathGuardWrapper(bin string) string {
	realBin := realSystemBin(bin)
	if realBin == "" {
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
