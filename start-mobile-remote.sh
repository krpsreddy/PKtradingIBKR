#!/usr/bin/env bash
# Run PK Mobile against home backend over Tailscale (works off home Wi‑Fi).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/load-mobile-env.sh
source "$ROOT/scripts/load-mobile-env.sh"

export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home}"
export PATH="$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"

if [[ -z "${API_BASE:-}" ]]; then
  API_BASE="$("$ROOT/scripts/detect-mobile-api-base.sh")"
fi

echo "=== PK Mobile — remote (Tailscale) ==="
echo "API_BASE=$API_BASE"
echo ""
echo "Requirements:"
echo "  • Mac at home: ./start-evolution.sh + IB Gateway"
echo "  • Mac + phone: Tailscale connected (same account)"
echo "  • Phone can be on cellular or any Wi‑Fi"
echo ""

if ! curl -sf --max-time 3 "${API_BASE}/api/live-trader/tier1" 2>/dev/null | head -c 1 >/dev/null; then
  if curl -sf --max-time 3 "http://127.0.0.1:8180/api/live-trader/tier1" 2>/dev/null | head -c 1 >/dev/null; then
    echo "NOTE: Backend OK on localhost; Tailscale path not verified from this Mac."
    echo "      If the phone fails, check Tailscale on both devices and Mac firewall."
  else
    echo "WARN: Backend not reachable. On the Mac run: ./start-evolution.sh"
  fi
else
  echo "Backend reachable at $API_BASE"
fi

SERIAL=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1; exit}')
if [[ -n "${SERIAL:-}" ]]; then
  LOCAL="${LOCAL_API_BASE:-http://${PK_LAN_IP:-192.168.2.25}:8180}"
  REMOTE="${REMOTE_API_BASE:-http://${PK_TAILSCALE_IP:-100.88.194.48}:8180}"
  export LOCAL_API_BASE="$LOCAL" REMOTE_API_BASE="$REMOTE"
  exec "$ROOT/start-mobile-android-phone.sh" "$@"
fi

echo ""
echo "No USB phone detected. Connect phone or run manually:"
echo "  cd pk-live-trader-mobile"
echo "  flutter run --dart-define=API_BASE=$API_BASE"
exit 1
