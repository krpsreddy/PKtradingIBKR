# Phase 151 — Multi-Day Replay Workstation + Session Selector

## Goal

Upgrade replay from single-candle playback into a professional multi-day execution review workstation using Phase 149 cached intelligence.

## Module

`frontend/src/app/services/replay-workstation/`

| File | Role |
|------|------|
| `replay-workstation.models.ts` | Types, catalog entries, display context |
| `replay-workstation-synthesis.service.ts` | Orchestrator — open session, display context, navigation |
| `multi-day-replay-store.service.ts` | Reactive workstation state (in synthesis file) |
| `replay-preload.engine.ts` | Cache-first session load via `/api/replay-cache/snapshot/{symbol}/{date}` |
| `replay-session-selector.service.ts` | Default session pick (persisted or latest ready) |
| `replay-session-navigation.engine.ts` | Prev/next/best/conviction session jumps |
| `replay-timeline-context.engine.ts` | Start modes + signal jump navigation |
| `replay-history-viewport.engine.ts` | Full-session viewport planning |
| `replay-session-persistence.service.ts` | sessionStorage persistence |

## Core UX changes

### Full session preload
- Chart receives **all session candles** immediately
- Future bars are **dimmed** (not sliced away)
- Playback only advances `replayIndex` / cursor — no chart rebuild

### Cache-first loading
```
Open replay → snapshot catalog → load session snapshot → render → set smart cursor
```
Fallback to legacy `/replay/history/{symbol}` only when cache miss.

### Session selector
- Dropdown of ready sessions from `GET /api/replay-cache/snapshot/{symbol}`
- Prev/next session navigation
- Jump to best setup / high conviction day

### Start modes
`SMART` (default), `OPEN`, `FIRST_SIGNAL`, `FIRST_ENTRY`, `VWAP_RECLAIM`, `SECOND_LEG`

### Review mode
All candles + all signals visible — execution study mode without playback.

### Multi-day context
`MULTI_DAY_CONTINUOUS` prepends prior session candles for overnight/trend context.

### Timeline scrubber + signal jumps
Drag slider or use Next Signal / Entry / Trap / Reclaim / Second Leg buttons.

## Integrations

- `DashboardComponent` — workstation-driven `loadHistoricalReplay()`, `refreshReplayView()`
- `ReplayPanelComponent` — session selector, scrubber, navigation, review toggle
- `TradingChartComponent` — `replayReviewMode`, `replayMaskFuture` dimming
- `ReplayCacheApiService.fetchSessionSnapshot()` — single-session cache load

## Constraints

UX/workstation only — no signal engine, strategy, or analytics logic changes.
