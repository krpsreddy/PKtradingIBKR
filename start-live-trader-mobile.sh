#!/usr/bin/env bash
# PK Mobile Live Trader — Flutter (Phase 185). Requires Flutter SDK + evolution backend on 8180.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/pk-live-trader-mobile"

API_BASE="${API_BASE:-http://localhost:8180}"

if ! command -v flutter >/dev/null 2>&1; then
  echo "ERROR: Flutter SDK not found. Install from https://flutter.dev"
  echo "Then: cd pk-live-trader-mobile && flutter pub get"
  exit 1
fi

echo "=== PK Mobile Live Trader ==="
echo "API: $API_BASE"
echo "Ensure evolution backend is running (./start-evolution.sh)"
echo ""

flutter pub get
flutter run --dart-define=API_BASE="$API_BASE" "$@"
