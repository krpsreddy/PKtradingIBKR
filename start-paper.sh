#!/usr/bin/env bash
# Phase 221 — PAPER runtime only (port 8180, IB Gateway paper 4002)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p logs

echo "=== PK PAPER RUNTIME (8180 / IBKR 4002) ==="
lsof -t -i:8180 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

export SPRING_PROFILES_ACTIVE=paper
export PK_APP_VARIANT=paper
export IBKR_PORT=4002

mvn -q compile spring-boot:run >> logs/paper-runtime.log 2>&1 &
echo "Paper backend PID=$! — log: logs/paper-runtime.log"
echo "API: http://localhost:8180/api/runtime/profile"
