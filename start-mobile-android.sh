#!/usr/bin/env bash
# PK Live Trader on Android: physical phone (USB) or emulator.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

physical_serial() {
  adb devices 2>/dev/null | awk 'NR>1 && $2=="device" && $1 !~ /^emulator-/ {print $1; exit}'
}

if [[ -n "$(physical_serial 2>/dev/null || true)" ]]; then
  exec "$ROOT/start-mobile-android-phone.sh" "$@"
fi

MOBILE="$ROOT/pk-live-trader-mobile"
API_BASE="${API_BASE:-http://10.0.2.2:8180}"

export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"

echo "=== PK Mobile — Android emulator ==="
echo "Physical phone plugged in? Use: ./start-mobile-android-phone.sh"
echo "API_BASE=$API_BASE (emulator → Mac localhost:8180)"
echo "Start backend first: ./start-evolution.sh"
echo ""

if ! curl -sf "http://127.0.0.1:8180/api/live-trader/tier1" 2>/dev/null | head -c 1 >/dev/null; then
  echo "WARN: Backend not reachable on 8180. Run ./start-evolution.sh first."
fi

if flutter emulators 2>/dev/null | grep -q pk_trader; then
  if ! adb devices 2>/dev/null | grep -q emulator; then
    echo "Starting emulator pk_trader..."
    flutter emulators --launch pk_trader &
    echo "Waiting for emulator boot..."
    adb wait-for-device
    sleep 8
  fi
fi

cd "$MOBILE"
flutter pub get
flutter run --dart-define=API_BASE="$API_BASE" "$@"
