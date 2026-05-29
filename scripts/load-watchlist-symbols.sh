#!/usr/bin/env bash
# One-time (idempotent) load of symbols into DB watchlist via backend API.
# Usage: ./scripts/load-watchlist-symbols.sh [symbols-file]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SYMBOL_FILE="${1:-${ROOT}/scripts/data/nasdaq-watchlist-symbols.txt}"
API_BASE="${API_BASE:-http://localhost:8080}"
GROUP_NAME="${GROUP_NAME:-Nasdaq100}"

if [[ ! -f "${SYMBOL_FILE}" ]]; then
  echo "ERROR: symbol file not found: ${SYMBOL_FILE}" >&2
  exit 1
fi

RAW_LINES="$(grep -v '^[[:space:]]*#' "${SYMBOL_FILE}" | grep -v '^[[:space:]]*$' || true)"
if [[ -z "${RAW_LINES}" ]]; then
  echo "ERROR: no symbols in ${SYMBOL_FILE}" >&2
  exit 1
fi

# De-dupe (case-insensitive); server also de-dupes on API path
UNIQUE=($(printf '%s\n' "${RAW_LINES}" | tr '[:lower:]' '[:upper:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed 's/^SIRIUS$/SIRI/' | sort -u))
JSON_SYMBOLS=$(printf '"%s",' "${UNIQUE[@]}")
JSON_SYMBOLS="[${JSON_SYMBOLS%,}]"

BODY=$(cat <<EOF
{"symbols":${JSON_SYMBOLS},"groupName":"${GROUP_NAME}","scanEnabled":true,"subscribeLive":true,"preloadOnStartup":true}
EOF
)

echo "Loading ${#UNIQUE[@]} unique symbols from ${SYMBOL_FILE} ..."
echo "API: ${API_BASE}/api/symbols/bulk-watchlist"

if curl -sf "${API_BASE}/api/system/status" >/dev/null 2>&1; then
  RESP=$(curl -sf -X POST "${API_BASE}/api/symbols/bulk-watchlist" \
    -H 'Content-Type: application/json' \
    -d "${BODY}")
  echo "${RESP}" | python3 -m json.tool 2>/dev/null || echo "${RESP}"
  echo "Done (API)."
  exit 0
fi

echo "Backend not up — loading via PostgreSQL (idempotent UPSERT) ..." >&2
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-trading_signals}"
DB_USER="${DB_USERNAME:-${USER:-pk}}"

TMP_SQL="$(mktemp)"
trap 'rm -f "${TMP_SQL}"' EXIT
{
  echo "BEGIN;"
  for sym in "${UNIQUE[@]}"; do
    printf "INSERT INTO trading_symbol (symbol, enabled, pinned, group_name, scan_enabled, preload_on_startup, subscribe_live, display_order, active, created_at, updated_at) SELECT '%s', true, false, '%s', true, true, true, COALESCE((SELECT MAX(display_order) FROM trading_symbol WHERE active), 0) + 1, true, NOW(), NOW() WHERE NOT EXISTS (SELECT 1 FROM trading_symbol t WHERE UPPER(t.symbol) = '%s' AND t.active); UPDATE trading_symbol SET enabled = true, active = true, group_name = '%s', scan_enabled = true, subscribe_live = true, preload_on_startup = true, updated_at = NOW() WHERE UPPER(symbol) = '%s';\n" \
      "${sym}" "${GROUP_NAME}" "${sym}" "${GROUP_NAME}" "${sym}"
  done
  echo "COMMIT;"
} > "${TMP_SQL}"

psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "${TMP_SQL}"
echo "Done (SQL). Loaded ${#UNIQUE[@]} symbols. Restart backend to activate subscriptions."
