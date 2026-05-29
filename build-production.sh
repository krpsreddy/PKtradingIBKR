#!/usr/bin/env bash
# One-time (or after code changes): build fat JAR + Angular static files.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export PATH="${ROOT}/.tools/node/bin:${ROOT}/frontend/node_modules/.bin:${PATH}"

echo "=== Build production artifacts ==="

echo "[1/2] Backend JAR (Maven package)..."
mvn -q package -DskipTests
JAR="$(ls -1 target/pktradingIBKR-*.jar 2>/dev/null | grep -v '.original' | head -1)"
if [[ -z "${JAR}" || ! -f "${JAR}" ]]; then
  echo "ERROR: JAR not found under target/"
  exit 1
fi
echo "  → ${JAR}"

echo "[2/2] Frontend (Angular evolution)..."
(
  cd "$ROOT/frontend"
  if [[ ! -d node_modules ]]; then
    echo "  npm install (first time)..."
    npm install
  fi
  ng build --configuration=evolution
)

DIST="$ROOT/frontend/dist/trading-dashboard"
if [[ -d "$DIST/browser" ]]; then
  DIST="$DIST/browser"
fi
if [[ ! -f "$DIST/index.html" ]]; then
  echo "ERROR: Frontend build missing index.html in $DIST"
  exit 1
fi

echo ""
echo "Done."
echo "  Backend JAR: ${JAR}"
echo "  Frontend:    ${DIST}"
echo ""
echo "Run: ./run-production.sh"
