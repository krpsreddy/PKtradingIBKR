#!/usr/bin/env bash
# Run PK Live Trader on a physical iPhone (requires Xcode + same Wi‑Fi as Mac).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$ROOT/pk-live-trader-mobile"

if [[ ! -d /Applications/Xcode.app && ! -d /Applications/Xcode_15.4.app ]]; then
  echo "ERROR: Xcode not installed."
  echo "On macOS 14.6: download Xcode 15.4 — see docs/INSTALL_XCODE_SONOMA.md"
  echo "Then run: ./finish-ios-setup.sh"
  exit 1
fi

if ! security find-identity -v -p codesigning 2>/dev/null | grep -q "Apple Development"; then
  echo "ERROR: No iOS Development certificate. Run once:"
  echo "  ./setup-ios-signing.sh"
  exit 1
fi

# shellcheck source=scripts/load-mobile-env.sh
source "$ROOT/scripts/load-mobile-env.sh"

LAN_IP="${PK_LAN_IP:-$(ipconfig getifaddr en0 2>/dev/null || true)}"
if [[ -z "$LAN_IP" ]]; then
  echo "Enter your Mac's Wi‑Fi IP (ipconfig getifaddr en0):"
  read -r LAN_IP
fi
LOCAL_API_BASE="${LOCAL_API_BASE:-http://${LAN_IP}:8180}"
REMOTE_API_BASE="${REMOTE_API_BASE:-http://${PK_TAILSCALE_IP:-100.88.194.48}:8180}"

echo "=== PK Mobile — iPhone ==="
echo "LOCAL_API_BASE=$LOCAL_API_BASE"
echo "REMOTE_API_BASE=$REMOTE_API_BASE"
echo "Use in-app Local/Remote switch. Backend: ./start-evolution.sh"
echo ""
echo "Home-screen launch (no Mac): ./install-ios-release.sh"
echo "  (debug via this script cannot be opened from icon — use --release or install-ios-release.sh)"
echo ""

if ! curl -sf "http://127.0.0.1:8180/api/live-trader/tier1" 2>/dev/null | head -c 1 >/dev/null; then
  echo "WARN: Backend not on 8180 — run ./start-evolution.sh"
fi

cd "$MOBILE"
flutter pub get
DEVICE="${IOS_DEVICE:-00008140-00015C1E1447001C}"
exec flutter run -d "$DEVICE" \
  --dart-define=LOCAL_API_BASE="$LOCAL_API_BASE" \
  --dart-define=REMOTE_API_BASE="$REMOTE_API_BASE" \
  "$@"
