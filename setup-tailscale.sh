#!/usr/bin/env bash
# One-time Tailscale setup on Mac for remote PK Mobile → home backend.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== PK Trading — Tailscale setup (Mac) ==="
echo ""

if ! command -v tailscale >/dev/null 2>&1; then
  echo "Installing Tailscale..."
  brew install --cask tailscale
fi

echo "1. Open the Tailscale app from Applications (or menu bar)."
echo "2. Sign in with Google / Microsoft / GitHub / email."
echo "3. On your phone: install Tailscale from Play Store / App Store, same account."
echo "4. Leave Tailscale ON on both devices."
echo ""
echo "When both show Connected, run:"
echo "  ./start-mobile-remote.sh          # USB Android phone"
echo "  API_BASE=\$(./scripts/tailscale-api-base.sh) ./build-mobile-apk.sh   # APK for away-from-home"
echo ""
echo "Docs: docs/MOBILE_REMOTE_TAILSCALE.md"
echo ""

if tailscale status >/dev/null 2>&1; then
  IP="$(tailscale ip -4 2>/dev/null | head -1 || true)"
  if [[ -n "${IP:-}" ]]; then
    echo "This Mac Tailscale IP: $IP"
    echo "Mobile API_BASE: http://${IP}:8180"
    if curl -sf --max-time 2 "http://127.0.0.1:8180/api/live-trader/tier1" >/dev/null 2>&1; then
      echo "Backend: OK on :8180"
    else
      echo "Backend: not running — start with ./start-evolution.sh"
    fi
  fi
else
  echo "Tailscale CLI not connected yet — complete login in the app, then re-run this script."
fi
