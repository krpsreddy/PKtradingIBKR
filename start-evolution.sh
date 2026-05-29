#!/usr/bin/env bash
# Evolution environment — Phase 181 paper execution research (backend 8180, frontend 4300).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export PATH="${ROOT}/.tools/node/bin:${ROOT}/frontend/node_modules/.bin:${PATH}"

echo "=== PKtradingIBKR EVOLUTION (Phase 181) ==="
echo "Backend:  http://localhost:8180"
echo "Frontend: http://localhost:4300"
echo "Profile:  evolution (PAPER_RESEARCH infrastructure)"
echo "IBKR:     auto-detect Gateway 4002 / TWS 7497 (force: IBKR_PORT=4002 ./start-evolution.sh)"
echo ""

# Stale backends keep IB Gateway client ids and cause error 326 for the new instance
echo "Stopping stray trading backends (IBKR client id cleanup)..."
pkill -f "com.tradingbot.TradingBotApplication" 2>/dev/null || true
sleep 2
lsof -t -i:8180 2>/dev/null | xargs kill -9 2>/dev/null || true

cleanup() {
  echo "Stopping evolution processes..."
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(
  cd "$ROOT"
  export SPRING_PROFILES_ACTIVE=evolution
  export PK_APP_VARIANT=evolution
  export IBKR_PORT="${IBKR_PORT:-7497}"
  mvn -q compile spring-boot:run
) &
BACKEND_PID=$!

sleep 8

(
  cd "$ROOT/frontend"
  export PK_APP_VARIANT=evolution
  if ! command -v ng >/dev/null 2>&1; then
    echo "ERROR: ng CLI not found. Run: cd frontend && npm install"
    exit 1
  fi
  ng serve --configuration=evolution --port=4300 --host=localhost
) &
FRONTEND_PID=$!

wait
