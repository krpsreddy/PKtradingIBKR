#!/usr/bin/env bash
# Print http://<mac-backend-host>:8180 for mobile API_BASE.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PK_BACKEND_PORT:-8180}"
FALLBACK_IP="${PK_TAILSCALE_IP:-100.88.194.48}"

# shellcheck source=scripts/load-mobile-env.sh
source "$ROOT/scripts/load-mobile-env.sh"

if [[ -n "${API_BASE:-}" ]]; then
  echo "$API_BASE"
  exit 0
fi

if command -v tailscale >/dev/null 2>&1 && tailscale status >/dev/null 2>&1; then
  IP="$(tailscale ip -4 2>/dev/null | head -1 | tr -d '[:space:]')"
  if [[ -n "${IP:-}" ]]; then
    echo "http://${IP}:${PORT}"
    exit 0
  fi
fi

if [[ -n "${PK_TAILSCALE_IP:-}" ]]; then
  echo "http://${PK_TAILSCALE_IP}:${PORT}"
  exit 0
fi

echo "http://${FALLBACK_IP}:${PORT}"
