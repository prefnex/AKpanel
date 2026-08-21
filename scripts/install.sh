#!/usr/bin/env bash
# ==============================================================================
#  AKpanel installer shim
# ==============================================================================
# The canonical installer is ./install.sh in the repository root — that is the only
# file the release workflow publishes as a release asset. This path used to hold a
# second full copy of the installer, which drifted out of sync and caused fixes to be
# applied to a script that never actually runs on a VPS.
#
# Keeping a shim here means any existing bookmark or automation still lands on the
# real installer instead of a stale duplicate.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANONICAL="${REPO_ROOT}/install.sh"

if [ ! -f "$CANONICAL" ]; then
  echo "AKpanel: canonical installer not found at ${CANONICAL}" >&2
  exit 1
fi

exec bash "$CANONICAL" "$@"
