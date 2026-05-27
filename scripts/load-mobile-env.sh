#!/usr/bin/env bash
# Source repo mobile.env if present (sets API_BASE, PK_TAILSCALE_IP).
_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$_ROOT/mobile.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$_ROOT/mobile.env"
  set +a
fi
