#!/usr/bin/env bash
# Phase 221 — LIVE runtime only (port 8080, IB Gateway live 4001)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p logs

echo "=== PK LIVE RUNTIME (8080 / IBKR 4001) ==="
lsof -t -i:8080 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

export SPRING_PROFILES_ACTIVE=live
export PK_APP_VARIANT=live
export IBKR_PORT=4001

mvn -q compile spring-boot:run >> logs/live-runtime.log 2>&1 &
echo "Live backend PID=$! — log: logs/live-runtime.log"
echo "API: http://localhost:8080/api/runtime/profile"
