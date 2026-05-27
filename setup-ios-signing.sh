#!/usr/bin/env bash
# One-time: enable iPhone installs (Apple development signing).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
MOBILE="$ROOT/pk-live-trader-mobile"

echo "=== iOS code signing (required once) ==="
echo ""
IDENTITIES=$(security find-identity -v -p codesigning 2>/dev/null | grep -c "Apple Development" || true)
if [[ "${IDENTITIES:-0}" -gt 0 ]]; then
  echo "Development certificate found. Run:"
  echo "  ./start-mobile-iphone.sh"
  exit 0
fi

echo "No Apple Development certificate on this Mac yet."
echo ""
echo "Do this in Xcode (opens automatically):"
echo "  1. Xcode → Settings → Accounts → add your Apple ID"
echo "  2. Open Runner target → Signing & Capabilities"
echo "  3. Check 'Automatically manage signing'"
echo "  4. Team: pick your Personal Team"
echo "  5. Bundle ID: com.pktrading.pk-live-trader-mobile (change if conflict)"
echo "  6. Connect iPhone USB → trust computer"
echo "  7. Product → Run (or close Xcode and run ./start-mobile-iphone.sh)"
echo ""
echo "On iPhone after first install:"
echo "  Settings → General → VPN & Device Management → Trust developer"
echo ""

open "$MOBILE/ios/Runner.xcworkspace" 2>/dev/null || open "$MOBILE/ios/Runner.xcodeproj"
