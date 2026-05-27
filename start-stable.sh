#!/usr/bin/env bash
# Stable environment — default ports (backend 8080, frontend 4200). No paper research profile.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export PATH="${ROOT}/.tools/node/bin:${ROOT}/frontend/node_modules/.bin:${PATH}"

echo "=== PKtradingIBKR STABLE ==="
echo "Backend:  http://localhost:8080"
echo "Frontend: http://localhost:4200"
echo "Profile:  default (paper-execution research OFF)"
echo ""

cleanup() {
  echo "Stopping stable processes..."
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(
  cd "$ROOT"
  unset SPRING_PROFILES_ACTIVE
  export PK_APP_VARIANT=stable
  mvn -q spring-boot:run -Dspring-boot.run.jvmArguments="-Dserver.port=8080"
) &
BACKEND_PID=$!

sleep 8

(
  cd "$ROOT/frontend"
  export PK_APP_VARIANT=stable
  if ! command -v ng >/dev/null 2>&1; then
    echo "ERROR: ng CLI not found. Run: cd frontend && npm install"
    exit 1
  fi
  ng serve --configuration=development --port=4200 --host=localhost
) &
FRONTEND_PID=$!

wait
