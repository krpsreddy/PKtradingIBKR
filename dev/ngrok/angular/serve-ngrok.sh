#!/usr/bin/env bash
# Start Angular dev server configured for ngrok frontend tunnel

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
URLS_FILE="${ROOT}/dev/ngrok/.ngrok-urls.env"

if [[ -f "$URLS_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$URLS_FILE"; set +a
fi

cd "${ROOT}/frontend"

export NGROK_BACKEND_URL="${NGROK_BACKEND_URL:-http://localhost:8080}"

echo "Angular ngrok dev server"
echo "  Backend API target: ${NGROK_BACKEND_URL}"
echo "  Use frontend ngrok URL in browser (with basic auth)"
echo ""

# --allowed-hosts=all: accept ngrok Host header (Angular 19+)
# --host 0.0.0.0: reachable from ngrok agent on same machine
exec npx ng serve \
  --host 0.0.0.0 \
  --port 4200 \
  --allowed-hosts=all \
  --configuration=development
