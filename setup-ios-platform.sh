#!/usr/bin/env bash
# Install iOS platform support when Xcode says "iOS X.X is not installed".
set -euo pipefail
echo "=== Download iOS platform (Xcode Components) ==="
echo "This is ~8GB. Required for physical iPhone + simulators."
echo ""
xcodebuild -downloadPlatform iOS
echo ""
echo "Done. Run: ./start-mobile-iphone.sh"
