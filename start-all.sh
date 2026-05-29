#!/usr/bin/env bash
# Phase 221 — both runtimes (isolated ports, client IDs, logs)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p logs

echo "=== PK DUAL RUNTIME (paper 8180 + live 8080) ==="
"$ROOT/start-paper.sh"
sleep 4
"$ROOT/start-live.sh"
echo ""
echo "Paper: http://localhost:8180/api/runtime/profile"
echo "Live:  http://localhost:8080/api/runtime/profile"
echo "Logs:  logs/paper-runtime.log  logs/live-runtime.log"
