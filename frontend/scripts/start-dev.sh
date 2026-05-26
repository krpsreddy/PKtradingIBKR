#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND="$(cd "$(dirname "$0")/.." && pwd)"
NGROK_URLS="${ROOT}/dev/ngrok/.ngrok-urls.env"

export PATH="${ROOT}/.tools/node/bin:${PATH}"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found. Install Node or ensure ${ROOT}/.tools/node/bin exists."
  exit 1
fi

PORT="${PORT:-4200}"

if lsof -ti:"${PORT}" >/dev/null 2>&1; then
  echo "Port ${PORT} in use — stopping stale process..."
  lsof -ti:"${PORT}" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

cd "${FRONTEND}"

USE_NGROK="${NGROK:-0}"
if [[ "$USE_NGROK" == "1" ]] || [[ -f "$NGROK_URLS" ]]; then
  if [[ -f "$NGROK_URLS" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$NGROK_URLS"; set +a
  fi
  echo "ngrok mode — binding 0.0.0.0, proxy /api → localhost:8080"
  [[ -n "${NGROK_FRONTEND_URL:-}" ]] && echo "  Frontend tunnel: ${NGROK_FRONTEND_URL}"
  echo "  API calls use relative /api (proxied — no CORS issues)"
  exec npx ng serve --configuration ngrok --port "${PORT}"
fi

exec npx ng serve --host localhost --port "${PORT}"
