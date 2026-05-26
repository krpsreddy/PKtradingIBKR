#!/usr/bin/env bash
# Generate ngrok.yml from .env (never commit the output)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

load_env

IP_BLOCK=""
if [[ -n "${NGROK_IP_ALLOWLIST:-}" ]]; then
  IP_BLOCK="    ip_restriction:\n      allow_cidrs:"
  IFS=',' read -ra CIDRS <<< "${NGROK_IP_ALLOWLIST}"
  for cidr in "${CIDRS[@]}"; do
    cidr="$(echo "$cidr" | xargs)"
    [[ -n "$cidr" ]] && IP_BLOCK+="\n        - ${cidr}"
  done
fi

FRONTEND_HOST=""
BACKEND_HOST=""
if [[ -n "${NGROK_FRONTEND_DOMAIN:-}" ]]; then
  FRONTEND_HOST="    hostname: ${NGROK_FRONTEND_DOMAIN}"
fi
if [[ -n "${NGROK_BACKEND_DOMAIN:-}" ]]; then
  BACKEND_HOST="    hostname: ${NGROK_BACKEND_DOMAIN}"
fi

WEB_ADDR="${NGROK_WEB_ADDR:-127.0.0.1:4040}"

cat > "$NGROK_CONFIG" <<EOF
# AUTO-GENERATED — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Regenerate: ./scripts/generate-config.sh

version: "3"

agent:
  authtoken: ${NGROK_AUTHTOKEN}
  web_addr: ${WEB_ADDR}

tunnels:
  frontend:
    proto: http
    addr: 4200
    schemes:
      - https
    basic_auth:
      - "${NGROK_BASIC_AUTH_USER}:${NGROK_BASIC_AUTH_PASS}"
${FRONTEND_HOST}

  backend:
    proto: http
    addr: 8080
    schemes:
      - https
    inspect: false
    basic_auth:
      - "${NGROK_BASIC_AUTH_USER}:${NGROK_BASIC_AUTH_PASS}"
${BACKEND_HOST}
EOF

# Append IP restriction to backend tunnel if configured
if [[ -n "${NGROK_IP_ALLOWLIST:-}" ]]; then
  {
    echo "    ip_restriction:"
    echo "      allow_cidrs:"
    IFS=',' read -ra CIDRS <<< "${NGROK_IP_ALLOWLIST}"
    for cidr in "${CIDRS[@]}"; do
      cidr="$(echo "$cidr" | xargs)"
      [[ -n "$cidr" ]] && echo "        - ${cidr}"
    done
  } >> "$NGROK_CONFIG"
fi

chmod 600 "$NGROK_CONFIG"
echo "Generated ${NGROK_CONFIG} (mode 600)"
