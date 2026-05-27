#!/usr/bin/env bash
# Build installable Android APK (release). Backend must run on Mac :8180.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$ROOT/pk-live-trader-mobile"
# shellcheck source=scripts/load-mobile-env.sh
source "$ROOT/scripts/load-mobile-env.sh"

LAN_IP="${PK_LAN_IP:-$(ipconfig getifaddr en0 2>/dev/null || echo 192.168.2.51)}"
LOCAL_API_BASE="${LOCAL_API_BASE:-http://${LAN_IP}:8180}"
REMOTE_API_BASE="${REMOTE_API_BASE:-http://${PK_TAILSCALE_IP:-100.88.194.48}:8180}"

export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"

AVAIL_KB=$(df -k /System/Volumes/Data 2>/dev/null | awk 'NR==2 {print $4}')
if [[ -n "${AVAIL_KB:-}" && "${AVAIL_KB}" -lt 500000 ]]; then
  echo "WARN: Low disk space ($(("${AVAIL_KB}" / 1024)) MB free). Build may fail."
  echo "      Free space: rm -rf ~/.gradle/caches/*/transforms pk-live-trader-mobile/build"
fi

echo "=== PK Mobile — build APK ==="
echo "LOCAL_API_BASE=$LOCAL_API_BASE"
echo "REMOTE_API_BASE=$REMOTE_API_BASE"
echo "(In-app Local/Remote switch — no rebuild needed to change mode)"
echo "Start backend before testing: ./start-evolution.sh"
echo ""

cd "$MOBILE"
flutter pub get
flutter build apk --release \
  --dart-define=LOCAL_API_BASE="$LOCAL_API_BASE" \
  --dart-define=REMOTE_API_BASE="$REMOTE_API_BASE"

APK="$MOBILE/build/app/outputs/flutter-apk/app-release.apk"
echo ""
echo "=== Done ==="
echo "APK: $APK"
echo "Size: $(ls -lh "$APK" | awk '{print $5}')"
echo ""
echo "Install on emulator/device:"
echo "  adb install -r \"$APK\""
echo ""
echo "Override URLs:"
echo "  LOCAL_API_BASE=http://\$(ipconfig getifaddr en0):8180 REMOTE_API_BASE=http://100.x.x.x:8180 ./build-mobile-apk.sh"
