# Phase 187 — Real-Time Live Scanner + Auto Hydration

## Problem (before)

- Scanner ranked only symbols with `evaluated_signal_snapshot` rows (~30/143).
- New watchlist symbols invisible until Global Edge Lab hydration.
- Rankings repeated prior sessions (60-day DB lookback).
- IBKR live feed did not materially change scanner order.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1 — LIVE SCANNER (trading, mobile, Telegram, alerts) │
├─────────────────────────────────────────────────────────────┤
│ IBKR ticks → SymbolContext → RealtimeRegimeEngine          │
│           → LiveScannerRollingCache (session-aware)        │
│           → LiveScannerService (@Scheduled 2s)             │
│           → /api/live-scanner/snapshot                     │
│           → /api/scanner/opportunities?mode=live (default) │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ async, non-blocking
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2 — BACKGROUND HYDRATION (research / replay only)    │
├─────────────────────────────────────────────────────────────┤
│ BackgroundHydrationOrchestrator → SymbolLoadService        │
│ Priority: HIGH (top ranks) · MEDIUM (new symbol) · LOW     │
│ Historical analytics: ?mode=historical on scanner API       │
└─────────────────────────────────────────────────────────────┘
```

## Deliverables

| # | Component | Package / path |
|---|-----------|----------------|
| 1 | `RealtimeRegimeEngine` | `intelligence.live` |
| 2 | `LiveScannerService` + `LiveScannerScheduler` | `intelligence.live` |
| 3 | Snapshot fallback removed for default API | `IntelligenceOffloadController` |
| 4 | `BackgroundHydrationOrchestrator` | `intelligence.live` |
| 5 | Live dominance via `LiveScannerRollingCache` | `intelligence.live` |
| 6 | In-memory rolling cache | `LiveScannerRollingCache` |
| 7 | Session reset | `MarketSessionClock` + cache `ensureSession()` |
| 8 | Mobile | `LiveTraderSnapshotService` uses live scanner |
| 9 | Auto hydration on symbol activate / bulk import | `TradingSymbolService` |
| 10 | Migration | `?mode=historical` preserves old path |

## APIs

- `GET /api/live-scanner/snapshot` — full enabled watchlist (recommended).
- `GET /api/scanner/opportunities?mode=live` — optional symbol filter.
- `GET /api/scanner/opportunities?mode=historical&symbols=AAPL` — replay research only.

## Frontend

- `AutonomousRegimeScannerService` uses `liveScannerSnapshot()` when watchlist > 25 symbols.
- Default scanner API mode is `live`.

## Verification

```bash
curl -s http://localhost:8180/api/live-scanner/snapshot | jq '.opportunities | length, .summaryInsights'
curl -s "http://localhost:8180/api/scanner/opportunities?symbols=NVDA&mode=live" | jq '.opportunities[0].symbol'
```

Expect opportunity count ≈ enabled watchlist size (not ~30 cap from analytics DB).
