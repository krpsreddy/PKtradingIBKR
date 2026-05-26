#!/usr/bin/env bash
# Start ngrok in background, wait for URLs, write .ngrok-urls.env

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

load_env
require_ngrok

PID_FILE="${NGROK_DEV_DIR}/.ngrok.pid"
LOG_FILE="${NGROK_DEV_DIR}/.ngrok.log"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "ngrok already running (PID $(cat "$PID_FILE")). Run ./scripts/stop.sh first."
  exit 1
fi

"${SCRIPT_DIR}/generate-config.sh"

nohup ngrok start frontend backend --config "$NGROK_CONFIG" > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "ngrok started in background (PID $(cat "$PID_FILE"), log: ${LOG_FILE})"

write_tunnel_urls
