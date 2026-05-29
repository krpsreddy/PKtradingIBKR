#!/usr/bin/env bash
# Serve pre-built Angular (static files). Port 4300. Run build-production.sh first.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

DIST="$ROOT/frontend/dist/trading-dashboard"
if [[ -d "$DIST/browser" ]]; then
  DIST="$DIST/browser"
fi
if [[ ! -f "$DIST/index.html" ]]; then
  echo "Frontend not built. Run: ./build-production.sh"
  exit 1
fi

lsof -t -i:4300 2>/dev/null | xargs kill -9 2>/dev/null || true

echo "=== Evolution frontend (static) ==="
echo "URL:     http://localhost:4300"
echo "API:     http://localhost:8180 (from environment.evolution.ts)"
echo "Folder:  ${DIST}"
echo "Stop:    Ctrl+C or ./stop-production.sh"
echo ""

if command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -s "$DIST" -l 4300
fi
if command -v python3 >/dev/null 2>&1; then
  echo "WARN: npx not found — using python3 (no SPA fallback). Install Node for best results."
  cd "$DIST"
  exec python3 -m http.server 4300
fi
echo "ERROR: need npx (Node) or python3 to serve static files"
exit 1
