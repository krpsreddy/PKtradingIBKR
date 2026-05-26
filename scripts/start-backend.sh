#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL is not running on localhost:5432"
  echo "Start Postgres first (e.g. brew services start postgresql@14)"
  exit 1
fi

if lsof -ti:8080 >/dev/null 2>&1; then
  echo "Port 8080 already in use — backend may already be running."
  echo "  curl http://localhost:8080/api/system/status"
  exit 1
fi

echo "Starting backend on http://localhost:8080 (IBKR port from application.properties)..."
exec mvn spring-boot:run
