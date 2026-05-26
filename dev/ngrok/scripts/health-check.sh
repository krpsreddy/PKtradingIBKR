#!/usr/bin/env bash
# Verify local apps and ngrok tunnels

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

load_env
require_curl
require_jq

WEB_ADDR="${NGROK_WEB_ADDR:-127.0.0.1:4040}"
AUTH="${NGROK_BASIC_AUTH_USER}:${NGROK_BASIC_AUTH_PASS}"

pass=0
fail=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "✓ ${name}"
    ((pass++)) || true
  else
    echo "✗ ${name}"
    ((fail++)) || true
  fi
}

echo "=== Local services ==="
check "Angular dev server (localhost:4200)" curl -sf -o /dev/null -m 5 http://localhost:4200/
check "Spring Boot (localhost:8080/api)" curl -sf -o /dev/null -m 5 http://localhost:8080/api/symbols || \
  curl -sf -o /dev/null -m 5 http://localhost:8080/actuator/health 2>/dev/null || \
  curl -sf -o /dev/null -m 5 http://localhost:8080/

echo ""
echo "=== ngrok agent ==="
check "ngrok agent API" curl -sf -o /dev/null -m 5 "http://${WEB_ADDR}/api/tunnels"

if curl -sf "http://${WEB_ADDR}/api/tunnels" >/dev/null 2>&1; then
  json="$(curl -sf "http://${WEB_ADDR}/api/tunnels")"
  frontend="$(echo "$json" | jq -r '.tunnels[] | select(.name=="frontend") | .public_url' | head -1)"
  backend="$(echo "$json" | jq -r '.tunnels[] | select(.name=="backend") | .public_url' | head -1)"

  echo ""
  echo "=== Public tunnels (HTTPS + basic auth) ==="
  if [[ -n "$frontend" && "$frontend" != "null" ]]; then
    check "Frontend tunnel ${frontend}" curl -sf -o /dev/null -m 10 -u "$AUTH" "${frontend}/"
  else
    echo "✗ Frontend tunnel not registered"
    ((fail++)) || true
  fi

  if [[ -n "$backend" && "$backend" != "null" ]]; then
    check "Backend tunnel ${backend}" curl -sf -o /dev/null -m 10 -u "$AUTH" "${backend}/api/symbols" || \
      curl -sf -o /dev/null -m 10 -u "$AUTH" "${backend}/"
  else
    echo "✗ Backend tunnel not registered"
    ((fail++)) || true
  fi

  echo ""
  echo "=== Security checks ==="
  if [[ -n "$backend" && "$backend" != "null" ]]; then
    if curl -sf -o /dev/null -m 5 "${backend}/actuator/env" 2>/dev/null; then
      echo "✗ WARNING: /actuator/env reachable without auth — lock down actuator!"
      ((fail++)) || true
    else
      echo "✓ Actuator env not publicly exposed (or blocked)"
      ((pass++)) || true
    fi
  fi
fi

echo ""
echo "Results: ${pass} passed, ${fail} failed"
[[ "$fail" -eq 0 ]]
