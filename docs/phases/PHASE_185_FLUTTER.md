# Phase 185 — PK Mobile Live Trader (Flutter)

**Status:** Scaffold implemented  
**Separate from:** Angular research platform (`frontend/`)

## Goal

Mobile execution terminal: dominant opportunities, live scanner, live IBKR prices, internal paper execution, P&L, advisories, Telegram hooks.

## Stack

- Flutter 3.x
- Riverpod
- Dio
- Adaptive polling (no duplicated regime logic)

## Backend APIs (source of truth)

| Endpoint | Use |
|----------|-----|
| `GET /api/live-trader/tier1` | Dominant + top ranked |
| `GET /api/live-trader/snapshot` | Positions, P&L, advisories, market |
| `GET/PUT /api/live-trader/runtime` | Scan / Telegram / Auto exec |
| `GET /api/quotes?symbols=` | Live IBKR marks |
| `GET /api/paper-execution/monitor` | Execution monitor |
| `PUT /api/paper-execution/mode` | OFF / PAPER_RESEARCH |

## Project layout

```
pk-live-trader-mobile/
  lib/
    core/config/          AppConfig, API_BASE dart-define
    core/theme/           PkTheme institutional dark
    models/               DTO mirrors (no scoring)
    services/api/         Dio clients
    services/polling/     LiveTraderRepository, MonitorRepository
    services/quote/       QuoteCache
    features/             Trader, Scanner, Positions, PnL, Monitor
    widgets/              Hero, rows, toggles
    screens/shell_screen  Bottom nav
```

## Execution policy

- Live IBKR session for quotes + scanner feed
- Internal paper simulation for fills/P&L (not IBKR paper account data)
- Auto exec: 1-share probes, entries autonomous, exits manual (advisories only)

## Telegram (backend-owned)

`LiveTraderTelegramService` — DOMINANT_NOW, EMERGING_FAST, etc. with cooldowns. Mobile only toggles `telegramEnabled` via runtime.

## Performance

- `IndexedStack` tabs — no rebuild off-screen routes
- `symbolQuoteProvider` — localized quote rebuilds
- Visible-symbol quote batching only (max 32)
- No replay / Edge Lab / analytics hydration

## Related

- React reference: `frontend-live-trader/` (port 4400)
- Phase 185B screener: `frontend-live-screener/`
- Terminology: `docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md`
