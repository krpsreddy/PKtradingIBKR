#!/usr/bin/env bash
# Run evolution backend from JAR only (no Maven compile). Port 8180.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

JAR="$(ls -1 target/pktradingIBKR-*.jar 2>/dev/null | grep -v '.original' | head -1)"
if [[ -z "${JAR}" || ! -f "${JAR}" ]]; then
  echo "JAR not found. Run: ./build-production.sh"
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: Java 21 required (java not in PATH)"
  exit 1
fi

echo "Stopping stale backends on 8180..."
pkill -f "pktradingIBKR-.*\\.jar" 2>/dev/null || true
pkill -f "com.tradingbot.TradingBotApplication" 2>/dev/null || true
sleep 1
lsof -t -i:8180 2>/dev/null | xargs kill -9 2>/dev/null || true

export SPRING_PROFILES_ACTIVE=evolution
export PK_APP_VARIANT=evolution
export IBKR_PORT="${IBKR_PORT:-7497}"

echo "=== Evolution backend (JAR) ==="
echo "JAR:     ${JAR}"
echo "API:     http://localhost:8180"
echo "IBKR:    port ${IBKR_PORT} (Gateway 4002 → IBKR_PORT=4002)"
echo "Stop:    Ctrl+C or ./stop-production.sh"
echo ""

exec java -jar "${JAR}"
