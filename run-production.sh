#!/usr/bin/env bash
# One-click: evolution backend (JAR) + frontend (static). Builds first if JAR/dist missing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

JAR="$(ls -1 target/pktradingIBKR-*.jar 2>/dev/null | grep -v '.original' | head -1 || true)"
DIST="$ROOT/frontend/dist/trading-dashboard"
[[ -d "$DIST/browser" ]] && DIST="$DIST/browser"

NEED_BUILD=false
[[ -z "${JAR}" || ! -f "${JAR}" ]] && NEED_BUILD=true
[[ ! -f "${DIST}/index.html" ]] && NEED_BUILD=true

if [[ "${NEED_BUILD}" == "true" ]]; then
  echo "Artifacts missing — running build-production.sh ..."
  "$ROOT/build-production.sh"
  JAR="$(ls -1 target/pktradingIBKR-*.jar 2>/dev/null | grep -v '.original' | head -1)"
fi

cleanup() {
  echo ""
  echo "Stopping production processes..."
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  pkill -f "pktradingIBKR-.*\\.jar" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Stopping stale processes..."
pkill -f "com.tradingbot.TradingBotApplication" 2>/dev/null || true
pkill -f "pktradingIBKR-.*\\.jar" 2>/dev/null || true
sleep 1
lsof -t -i:8180 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -t -i:4300 2>/dev/null | xargs kill -9 2>/dev/null || true

export SPRING_PROFILES_ACTIVE=evolution
export PK_APP_VARIANT=evolution
export IBKR_PORT="${IBKR_PORT:-7497}"

echo ""
echo "=== PKtradingIBKR PRODUCTION (1-click) ==="
echo "Backend:  http://localhost:8180  (JAR)"
echo "Frontend: http://localhost:4300  (static)"
echo "Mobile:   point app at http://<this-machine-ip>:8180"
echo "IBKR:     Gateway running; paper often IBKR_PORT=4002"
echo "Stop:     Ctrl+C"
echo ""

(
  exec java -jar "${JAR}"
) &
BACKEND_PID=$!

echo "Waiting for backend..."
for _ in $(seq 1 40); do
  if curl -sf "http://localhost:8180/actuator/health" >/dev/null 2>&1 \
     || curl -sf "http://localhost:8180/api/live-trader/runtime" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

(
  export PATH="${ROOT}/.tools/node/bin:${PATH}"
  if command -v npx >/dev/null 2>&1; then
    exec npx --yes serve -s "$DIST" -l 4300
  else
    cd "$DIST" && exec python3 -m http.server 4300
  fi
) &
FRONTEND_PID=$!

echo "Backend PID ${BACKEND_PID}, Frontend PID ${FRONTEND_PID}"
echo "Ready."
wait
