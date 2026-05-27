#!/usr/bin/env bash
# Install release build on iPhone — launch from home screen (no Flutter attached).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$ROOT/pk-live-trader-mobile"
# shellcheck source=scripts/load-mobile-env.sh
source "$ROOT/scripts/load-mobile-env.sh"

LAN_IP="${PK_LAN_IP:-$(ipconfig getifaddr en0 2>/dev/null || echo 192.168.2.51)}"
LOCAL_API_BASE="${LOCAL_API_BASE:-http://${LAN_IP}:8180}"
REMOTE_API_BASE="${REMOTE_API_BASE:-http://${PK_TAILSCALE_IP:-100.88.194.48}:8180}"
DEVICE="${IOS_DEVICE:-00008140-00015C1E1447001C}"

export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home}"

echo "=== PK Mobile — iOS release install ==="
echo "LOCAL=$LOCAL_API_BASE  REMOTE=$REMOTE_API_BASE"
echo "Device: $DEVICE (USB recommended; wireless may be slower)"
echo ""

cd "$MOBILE"
flutter pub get
flutter build ios --release \
  --dart-define=LOCAL_API_BASE="$LOCAL_API_BASE" \
  --dart-define=REMOTE_API_BASE="$REMOTE_API_BASE"

flutter install --release -d "$DEVICE"

echo ""
echo "=== Done ==="
echo "Open PK Live Trader from the iPhone home screen."
echo "Debug builds require flutter run / Xcode; this release build does not."
