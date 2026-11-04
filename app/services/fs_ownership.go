package services

import (
	"fmt"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

// fixTreeOwnership chowns target (inside jailRoot) recursively to uid:gid and normalises modes
// (dirs 755, files 644). Every component is opened relative to its parent with O_NOFOLLOW, so a
// path can never be redirected through a symlink, even if the tenant swaps one in mid-walk.
func fixTreeOwnership(jailRoot, target string, uid, gid int) error {
	jailRoot = filepath.Clean(jailRoot)
	target = filepath.Clean(target)
	rel, err := filepath.Rel(jailRoot, target)
	if err != nil || strings.HasPrefix(rel, "..") {
		return fmt.Errorf("access denied: path is outside your home jail")
	}

	dirfd, err := unix.Open(jailRoot, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return err
	}

	// Descend to the target's parent one component at a time.
	parts := []string{}
	if rel != "." {
		parts = strings.Split(rel, string(filepath.Separator))
	}
	if len(parts) == 0 {
		defer unix.Close(dirfd)
		_ = unix.Fchownat(dirfd, "", uid, gid, unix.AT_EMPTY_PATH)
		return fixDirContents(dirfd, uid, gid, 0)
	}
	for _, p := range parts[:len(parts)-1] {
		next, err := unix.Openat(dirfd, p, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		unix.Close(dirfd)
		if err != nil {
			return err
		}
		dirfd = next
	}
	defer unix.Close(dirfd)
	return fixEntry(dirfd, parts[len(parts)-1], uid, gid, 0)
}

const maxFixDepth = 64

func fixEntry(parentfd int, name string, uid, gid, depth int) error {
	var st unix.Stat_t
	if err := unix.Fstatat(parentfd, name, &st, unix.AT_SYMLINK_NOFOLLOW); err != nil {
		return nil
	}
	_ = unix.Fchownat(parentfd, name, uid, gid, unix.AT_SYMLINK_NOFOLLOW)
	switch st.Mode & unix.S_IFMT {
	case unix.S_IFREG:
		_ = unix.Fchmodat(parentfd, name, 0644, 0)
	case unix.S_IFDIR:
		if depth >= maxFixDepth {
			return nil
		}
		fd, err := unix.Openat(parentfd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		if err != nil {
			return nil
		}
		defer unix.Close(fd)
		_ = unix.Fchmod(fd, 0755)
		return fixDirContents(fd, uid, gid, depth+1)
	}
	return nil
}

func fixDirContents(dirfd, uid, gid, depth int) error {
	// Dup so ReadDirent's offset does not interfere with the caller's descriptor.
	fd, err := unix.Openat(dirfd, ".", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return err
	}
	defer unix.Close(fd)

	buf := make([]byte, 8192)
	for {
		n, err := unix.ReadDirent(fd, buf)
		if err != nil {
			return err
		}
		if n <= 0 {
			return nil
		}
		_, _, names := unix.ParseDirent(buf[:n], -1, nil)
		for _, name := range names {
			if err := fixEntry(fd, name, uid, gid, depth); err != nil {
				return err
			}
		}
	}
}
