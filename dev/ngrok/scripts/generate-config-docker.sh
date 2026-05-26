#!/usr/bin/env bash
# Generate ngrok.yml with host.docker.internal for Docker agent

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

load_env
WEB_ADDR="${NGROK_WEB_ADDR:-127.0.0.1:4040}"

cat > "$NGROK_CONFIG" <<EOF
# AUTO-GENERATED for Docker — $(date -u +"%Y-%m-%dT%H:%M:%SZ")

version: "3"

agent:
  authtoken: ${NGROK_AUTHTOKEN}
  web_addr: 0.0.0.0:4040

tunnels:
  frontend:
    proto: http
    addr: host.docker.internal:4200
    schemes:
      - https
    basic_auth:
      - "${NGROK_BASIC_AUTH_USER}:${NGROK_BASIC_AUTH_PASS}"

  backend:
    proto: http
    addr: host.docker.internal:8080
    schemes:
      - https
    inspect: false
    basic_auth:
      - "${NGROK_BASIC_AUTH_USER}:${NGROK_BASIC_AUTH_PASS}"
EOF

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
echo "Generated Docker ngrok config: ${NGROK_CONFIG}"
