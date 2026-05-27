#!/usr/bin/env bash
# Install Xcode for iOS — macOS 14.6 needs Xcode 15.4 (not App Store Xcode 26).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

sw_vers 2>/dev/null || true
OS_MAJOR="${MACOS_MAJOR:-$(sw_vers -productVersion | cut -d. -f1)}"
OS_MINOR="${MACOS_MINOR:-$(sw_vers -productVersion | cut -d. -f2)}"

echo "=== PK — Xcode install helper ==="
echo ""

if [[ -d /Applications/Xcode.app ]]; then
  echo "Found /Applications/Xcode.app"
  xcodebuild -version 2>/dev/null || true
  read -r -p "Run finish-ios-setup.sh now? [Y/n] " ans
  [[ "${ans,,}" == "n" ]] || exec "$ROOT/finish-ios-setup.sh"
  exit 0
fi

# App Store Xcode 26+ requires macOS 26.2 — wrong for Sonoma 14.x
if [[ "$OS_MAJOR" -eq 14 ]]; then
  echo "Your Mac: macOS 14.x (Sonoma)"
  echo ""
  echo "The App Store Xcode requires macOS 26.2+ — it will NOT install on this Mac."
  echo ""
  echo "Use Xcode 15.4 instead (supports Sonoma 14.0+):"
  echo "  1. Open: https://developer.apple.com/download/all/"
  echo "  2. Sign in with Apple ID (free developer account)"
  echo "  3. Download: Xcode_15.4.xip"
  echo "  4. Double-click .xip → drag Xcode.app to Applications"
  echo "  5. Open Xcode once (license + components)"
  echo "  6. Run: ./finish-ios-setup.sh"
  echo ""
  echo "Full guide: docs/INSTALL_XCODE_SONOMA.md"
  echo ""
  read -r -p "Open download page in browser? [Y/n] " open
  if [[ "${open,,}" != "n" ]]; then
    open "https://developer.apple.com/download/all/" 2>/dev/null || true
  fi
  exit 0
fi

echo "Opening App Store (newer macOS may use latest Xcode)..."
open "macappstore://apps.apple.com/app/xcode/id497799835" 2>/dev/null || true
echo "After install: ./finish-ios-setup.sh"
