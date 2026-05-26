#!/usr/bin/env bash
# Start both ngrok tunnels (frontend + backend)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

load_env
require_ngrok

"${SCRIPT_DIR}/generate-config.sh"

echo "Starting ngrok tunnels (frontend:4200, backend:8080)..."
echo "Agent UI: http://${NGROK_WEB_ADDR:-127.0.0.1:4040} (local only)"
echo "Press Ctrl+C to stop."
echo ""

# Foreground — both tunnels
exec ngrok start frontend backend --config "$NGROK_CONFIG"
