# Phase 195 — Replay Lab simplification & runtime UI removal

## Goal

Replay Lab is a **historical execution workstation** only. Live scanner, watchlist runtime, hydration, and execution feeds belong in **PK Live Trader (Flutter)**.

## Frontend

| Piece | Change |
|-------|--------|
| `ReplayIsolationModeService` | Hard-off live polling/UI when `ResearchModeService.isResearch()` |
| `ReplayLabHeaderComponent` | Symbol, price, regime, lifecycle, replay time, speed (+ optional dominance) |
| `ReplayLabFiltersComponent` | Primary research filters + collapsible advanced |
| `ReplayReviewSidebarComponent` | Right panel: execution review context only |
| `WorkspaceModeSwitchComponent` | Research tabs: Replay · Review · Discovery · Strategy Validation |
| `DashboardComponent` | Hides trading sidebar, live toolbar, metrics spam, execution rail/dock |

### Removed in research Replay Lab

- Live Opportunities, Watchlist, Live Execution Feed
- Scanning / Hydrate toggles
- Autonomous scanner sidebar
- Monitor / Execution Console toolbar (link to `/execution-review` instead)
- Full metrics bar (RSI/MACD/temp/discipline)
- Market environment ribbon
- Best-setup CTA, quick-action bar, live execution rail

### Live debug

`Enable live debug` restores legacy dashboard + live runtime (Phase 192).

## Verify

1. Open `http://localhost:4300/replay-lab`
2. Right panel shows **Execution Review** only (no watchlist)
3. Network tab: no scanner/feed/nano polling (research orchestrator)
4. Top strip: symbol, price, regime, lifecycle, replay time, speed
