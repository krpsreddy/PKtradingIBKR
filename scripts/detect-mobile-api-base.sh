#!/usr/bin/env bash
# Pick API_BASE that the phone can actually reach (LAN vs Tailscale).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PK_BACKEND_PORT:-8180}"
# shellcheck source=scripts/load-mobile-env.sh
source "$ROOT/scripts/load-mobile-env.sh"

detect_lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

phone_curl_ok() {
  local serial="$1" url="$2"
  adb -s "$serial" shell "curl -sf --max-time 5 '${url}/api/live-trader/tier1'" 2>/dev/null | head -c 1 | grep -q .
}

physical_serial() {
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1; exit}'
}

SERIAL="$(physical_serial 2>/dev/null || true)"
LAN="$(detect_lan_ip)"
TS_IP="${PK_TAILSCALE_IP:-100.88.194.48}"

if [[ -n "${SERIAL:-}" ]]; then
  if [[ -n "${LAN:-}" ]] && phone_curl_ok "$SERIAL" "http://${LAN}:${PORT}"; then
    echo "http://${LAN}:${PORT}"
    exit 0
  fi
  if phone_curl_ok "$SERIAL" "http://${TS_IP}:${PORT}"; then
    echo "http://${TS_IP}:${PORT}"
    exit 0
  fi
  adb -s "$SERIAL" reverse tcp:8180 tcp:8180 2>/dev/null || true
  if phone_curl_ok "$SERIAL" "http://127.0.0.1:${PORT}"; then
    echo "http://127.0.0.1:${PORT}"
    exit 0
  fi
fi

# No phone: prefer LAN if backend answers there
if [[ -n "${LAN:-}" ]] && curl -sf --max-time 2 "http://${LAN}:${PORT}/api/live-trader/tier1" >/dev/null 2>&1; then
  echo "http://${LAN}:${PORT}"
  exit 0
fi

if curl -sf --max-time 2 "http://${TS_IP}:${PORT}/api/live-trader/tier1" >/dev/null 2>&1; then
  echo "http://${TS_IP}:${PORT}"
  exit 0
fi

# mobile.env / tailscale script fallback
"$ROOT/scripts/tailscale-api-base.sh"
