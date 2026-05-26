#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGROK_DEV_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PID_FILE="${NGROK_DEV_DIR}/.ngrok.pid"

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo "Stopped ngrok (PID ${pid})"
  fi
  rm -f "$PID_FILE"
else
  pkill -f "ngrok start frontend backend" 2>/dev/null && echo "Stopped ngrok processes" || echo "No ngrok process found"
fi
