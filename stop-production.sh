#!/usr/bin/env bash
# Stop JAR backend + static frontend.
set -euo pipefail
echo "Stopping production..."
pkill -f "pktradingIBKR-.*\\.jar" 2>/dev/null || true
pkill -f "com.tradingbot.TradingBotApplication" 2>/dev/null || true
lsof -t -i:8180 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -t -i:4300 2>/dev/null | xargs kill -9 2>/dev/null || true
pkill -f "serve -s.*trading-dashboard" 2>/dev/null || true
echo "Done."
