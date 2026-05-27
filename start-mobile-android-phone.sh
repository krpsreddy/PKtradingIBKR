#!/usr/bin/env bash
# Run PK Live Trader on a USB-connected Android phone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$ROOT/pk-live-trader-mobile"

export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"

physical_android_connected() {
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1; exit}' | grep -q .
}

echo "=== PK Mobile — Android phone ==="
echo "1. Phone: Settings → Developer options → USB debugging ON"
echo "2. Connect USB, tap Allow on the phone when prompted"
echo "3. Backend on this Mac: ./start-evolution.sh  (port 8180)"
echo ""

if ! physical_android_connected; then
  echo "No Android phone seen yet. Current adb devices:"
  adb devices -l || true
  echo ""
  echo "Waiting up to 60s for a device..."
  adb wait-for-device
  sleep 2
fi

SERIAL=$(adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1; exit}')
if [[ -z "${SERIAL:-}" ]]; then
  echo "ERROR: Still no physical Android device. Check cable, debugging, and 'adb devices'."
  exit 1
fi

echo "Device: $SERIAL"

# shellcheck source=scripts/load-mobile-env.sh
source "$ROOT/scripts/load-mobile-env.sh"
adb -s "$SERIAL" reverse tcp:8180 tcp:8180 2>/dev/null || true

if [[ -z "${API_BASE:-}" ]]; then
  API_BASE="$("$ROOT/scripts/detect-mobile-api-base.sh")"
fi

if ! curl -sf "http://127.0.0.1:8180/api/live-trader/tier1" 2>/dev/null | head -c 1 >/dev/null; then
  echo "WARN: Backend not on 8180. Run: ./start-evolution.sh"
else
  echo "Backend OK on :8180"
fi

if adb -s "$SERIAL" shell "curl -sf --max-time 4 ${API_BASE}/api/live-trader/tier1" 2>/dev/null | head -c 1 >/dev/null; then
  echo "Phone → backend OK via $API_BASE"
else
  echo "WARN: Phone cannot reach $API_BASE"
  echo "  • At home: same Wi‑Fi as Mac → uses ${PK_LAN_IP:-LAN}"
  echo "  • Away: install Tailscale on phone (same account), then use http://100.88.194.48:8180"
fi
echo "API_BASE=$API_BASE"
echo ""

cd "$MOBILE"
flutter pub get >/dev/null
LAN_IP="${PK_LAN_IP:-$(ipconfig getifaddr en0 2>/dev/null || echo 192.168.2.51)}"
LOCAL="${LOCAL_API_BASE:-http://${LAN_IP}:8180}"
REMOTE="${REMOTE_API_BASE:-http://${PK_TAILSCALE_IP:-100.88.194.48}:8180}"
exec flutter run -d "$SERIAL" \
  --dart-define=LOCAL_API_BASE="$LOCAL" \
  --dart-define=REMOTE_API_BASE="$REMOTE" \
  "$@"
