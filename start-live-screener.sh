#!/usr/bin/env bash
# Phase 185 — lightweight live screener only (React, port 4410). Backend 8180 required.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="${ROOT}/.tools/node/bin:${PATH}"
cd "$ROOT/frontend-live-screener"

if [[ ! -d node_modules ]]; then
  echo "Installing live-screener dependencies..."
  npm install
fi

echo "=== PK Live Screener ==="
echo "UI:      http://localhost:4410"
echo "API:     http://localhost:8180"
echo ""

npm run dev
