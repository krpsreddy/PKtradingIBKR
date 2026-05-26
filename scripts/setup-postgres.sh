#!/usr/bin/env bash
# Create trading_signals database for local dev (macOS Homebrew / Postgres.app)

set -euo pipefail

DB_NAME="${DB_NAME:-trading_signals}"
DB_USER="${DB_USERNAME:-${USER:-pk}}"

if command -v createdb >/dev/null 2>&1; then
  CREATEDB=createdb
elif [ -x "/opt/homebrew/opt/postgresql@16/bin/createdb" ]; then
  CREATEDB="/opt/homebrew/opt/postgresql@16/bin/createdb"
elif [ -x "/opt/homebrew/opt/postgresql@15/bin/createdb" ]; then
  CREATEDB="/opt/homebrew/opt/postgresql@15/bin/createdb"
elif [ -x "/Applications/Postgres.app/Contents/Versions/latest/bin/createdb" ]; then
  CREATEDB="/Applications/Postgres.app/Contents/Versions/latest/bin/createdb"
else
  echo "createdb not found. Install PostgreSQL, then run:"
  echo "  createdb ${DB_NAME}"
  exit 1
fi

if "${CREATEDB}" --username="${DB_USER}" "${DB_NAME}" 2>/dev/null; then
  echo "Created database: ${DB_NAME} (user: ${DB_USER})"
elif psql -U "${DB_USER}" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "${DB_NAME}"; then
  echo "Database already exists: ${DB_NAME}"
else
  echo "Failed to create ${DB_NAME}. Try manually:"
  echo "  createdb ${DB_NAME}"
  exit 1
fi
