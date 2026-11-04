package services

import (
	"fmt"
	"os"
	"os/exec"
	"os/user"
	"runtime"
	"strconv"
	"syscall"
	"unsafe"
)

// TenantIdentity is the Linux identity of a hosting account. Every file operation performed on
// behalf of a tenant runs with this identity, so the kernel enforces the jail: a symlink planted
// in a home directory can never be used to read or write files the tenant could not touch itself.
type TenantIdentity struct {
	Username string
	UID      int
	GID      int
	Home     string
}

// LookupTenant resolves a hosting account to its Linux identity. Privileged accounts are refused.
func LookupTenant(username string) (*TenantIdentity, error) {
	if !IsValidAccountUsername(username) {
		return nil, fmt.Errorf("invalid hosting account name")
	}
	u, err := user.Lookup(username)
	if err != nil {
		return nil, fmt.Errorf("linux account for '%s' not found", username)
	}
	uid, err1 := strconv.Atoi(u.Uid)
	gid, err2 := strconv.Atoi(u.Gid)
	if err1 != nil || err2 != nil || uid < 1000 || gid < 1000 {
		return nil, fmt.Errorf("refusing to act as privileged account '%s'", username)
	}
	return &TenantIdentity{Username: username, UID: uid, GID: gid, Home: u.HomeDir}, nil
}

// Raw per-thread credential syscalls. The glibc/Go wrappers broadcast to all threads, which is
// exactly what must not happen here: only the locked worker thread may change identity.
func rawSetfsuid(uid int) int {
	r, _, _ := syscall.RawSyscall(syscall.SYS_SETFSUID, uintptr(uid), 0, 0)
	return int(r)
}

func rawSetfsgid(gid int) int {
	r, _, _ := syscall.RawSyscall(syscall.SYS_SETFSGID, uintptr(gid), 0, 0)
	return int(r)
}

func rawGetgroups() ([]uint32, error) {
	n, _, errno := syscall.RawSyscall(syscall.SYS_GETGROUPS, 0, 0, 0)
	if errno != 0 {
		return nil, errno
	}
	groups := make([]uint32, n+1)
	n, _, errno = syscall.RawSyscall(syscall.SYS_GETGROUPS, uintptr(len(groups)), uintptr(unsafe.Pointer(&groups[0])), 0)
	if errno != 0 {
		return nil, errno
	}
	return groups[:n], nil
}

func rawSetgroups(groups []uint32) error {
	var ptr uintptr
	if len(groups) > 0 {
		ptr = uintptr(unsafe.Pointer(&groups[0]))
	}
	_, _, errno := syscall.RawSyscall(syscall.SYS_SETGROUPS, uintptr(len(groups)), ptr, 0)
	if errno != 0 {
		return errno
	}
	return nil
}

// currentFsuid returns the thread's fsuid without changing it (-1 is rejected by the kernel).
func currentFsuid() int { return rawSetfsuid(-1) }
func currentFsgid() int { return rawSetfsgid(-1) }

// Do runs fn on a dedicated OS thread whose filesystem identity is the tenant's.
func (t *TenantIdentity) Do(fn func() error) error {
	runtime.LockOSThread()

	origGroups, err := rawGetgroups()
	if err != nil {
		runtime.UnlockOSThread()
		return fmt.Errorf("tenant identity: %w", err)
	}
	if err := rawSetgroups([]uint32{uint32(t.GID)}); err != nil {
		runtime.UnlockOSThread()
		return fmt.Errorf("tenant identity: %w", err)
	}
	rawSetfsgid(t.GID)
	rawSetfsuid(t.UID)

	restored := false
	defer func() {
		rawSetfsuid(0)
		rawSetfsgid(0)
		if rawSetgroups(origGroups) == nil && currentFsuid() == 0 && currentFsgid() == 0 {
			restored = true
		}
		// A thread that could not be restored is left locked: Go then destroys it when this
		// goroutine exits, so it can never run unrelated work with a tenant identity.
		if restored {
			runtime.UnlockOSThread()
		}
	}()

	if currentFsuid() != t.UID || currentFsgid() != t.GID {
		return fmt.Errorf("tenant identity: failed to switch filesystem credentials")
	}
	return fn()
}

// Command builds an external command that runs entirely as the tenant.
func (t *TenantIdentity) Command(name string, args ...string) *exec.Cmd {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Credential: &syscall.Credential{Uid: uint32(t.UID), Gid: uint32(t.GID), Groups: []uint32{}},
		Setsid:     true,
	}
	cmd.Env = []string{
		"HOME=" + t.Home,
		"USER=" + t.Username,
		"LOGNAME=" + t.Username,
		"PATH=/usr/local/bin:/usr/bin:/bin",
		"LANG=C.UTF-8",
		"GIT_TERMINAL_PROMPT=0",
	}
	cmd.Dir = t.Home
	if _, err := os.Stat(t.Home); err != nil {
		cmd.Dir = "/"
	}
	return cmd
}
