#!/usr/bin/env bash
# Phase 185B — lightweight operational live trader (React, port 4400). Backend 8180 required.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="${ROOT}/.tools/node/bin:${PATH}"
cd "$ROOT/frontend-live-trader"

if [[ ! -d node_modules ]]; then
  echo "Installing live-trader dependencies..."
  npm install
fi

echo "=== PK Live Trader (operational) ==="
echo "UI:      http://localhost:4400"
echo "API:     http://localhost:8180 (run ./start-evolution.sh or backend only first)"
echo ""

npm run dev
