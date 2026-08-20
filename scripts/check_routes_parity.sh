#!/usr/bin/env bash
# Read-only route parity check: compares facades.Route() registrations from
# git HEAD routes/web.go against all current routes/*.go files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

extract_routes() {
  local file="$1"
  grep -E 'facades\.Route\(\)\.(Get|Post|Put|Patch|Delete|Any|Options|Static|Fallback)\(' "$file" 2>/dev/null \
    | sed -E 's/.*facades\.Route\(\)\.([A-Za-z]+)\("([^"]*)".*/\1 \2/' \
    | grep -v '^Static ' \
    | grep -v '^Fallback ' || true
}

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

git show HEAD:routes/web.go > "$TMPDIR/old_web.go"
extract_routes "$TMPDIR/old_web.go" | sort > "$TMPDIR/old.txt"

{
  for f in routes/*.go; do
    extract_routes "$f"
  done
} | sort > "$TMPDIR/new.txt"

echo "=== Route count (excluding Static/Fallback) ==="
echo "OLD: $(wc -l < "$TMPDIR/old.txt")"
echo "NEW: $(wc -l < "$TMPDIR/new.txt")"
echo

if diff -u "$TMPDIR/old.txt" "$TMPDIR/new.txt"; then
  echo "OK: route method+path lists match."
  exit 0
else
  echo "FAIL: route lists differ."
  exit 1
fi
