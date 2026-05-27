#!/usr/bin/env bash
# Run once after installing Xcode from the App Store (iPhone builds).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$ROOT/pk-live-trader-mobile"

XCODE_APP="${XCODE_APP:-/Applications/Xcode.app}"
if [[ ! -d "$XCODE_APP" ]]; then
  if [[ -d /Applications/Xcode_15.4.app ]]; then
    XCODE_APP="/Applications/Xcode_15.4.app"
  fi
fi
if [[ ! -d "$XCODE_APP" ]]; then
  echo "ERROR: Xcode not found in /Applications."
  echo "On macOS 14.6 Sonoma, download Xcode 15.4 from:"
  echo "  https://developer.apple.com/download/all/"
  echo "See: docs/INSTALL_XCODE_SONOMA.md"
  exit 1
fi
echo "Using: $XCODE_APP"

echo "=== Finishing iOS setup ==="
sudo xcode-select --switch "$XCODE_APP/Contents/Developer"
sudo xcodebuild -runFirstLaunch

echo "Accepting Xcode license (may prompt)..."
sudo xcodebuild -license accept 2>/dev/null || true

flutter precache --ios
cd "$MOBILE"
flutter pub get

if [[ -f ios/Podfile ]]; then
  cd ios && pod install && cd ..
elif [[ -d ios ]]; then
  echo "iOS uses Swift Package Manager (no Podfile) — OK for Flutter 3.44"
fi

flutter doctor

echo ""
echo "Done. Run on iPhone:"
echo "  ipconfig getifaddr en0   # Mac LAN IP"
echo "  ./start-mobile-iphone.sh"
echo "Or in Cursor: launch config 'PK Live Trader (iPhone LAN)'"
