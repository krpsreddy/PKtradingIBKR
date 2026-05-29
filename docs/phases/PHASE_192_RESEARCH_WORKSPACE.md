# Phase 192 — Angular research / replay workspace only

## Decision

| Platform | Role |
|----------|------|
| **Flutter PK Live Trader** | Live scanner, execution, orchestration, P&L, alerts, auto paper |
| **Angular (evolution)** | Replay, execution review, Edge Lab, validation, telemetry — **not** live runtime |

## Frontend

### `ResearchModeService`

- Modes: `RESEARCH` (default on evolution), `LIVE_DEBUG` (developer only)
- Persisted: `{storagePrefix}platform-mode`
- `allowsLiveRuntime()` → true only in `LIVE_DEBUG`

### Landing (`/`)

`ResearchHomeComponent` — entry cards:

1. Execution Review → `/execution-review`
2. Replay Lab → `/replay-lab` (former dashboard)
3. Edge Lab → `/signal-lab`
4. Validation → `/autonomous-discovery`

`/dashboard` redirects to `/replay-lab`.

### Research mode (default)

**Disabled:**

- Dashboard scheduler: nano pulse, execution feed, scanner, system light poll, market heartbeat, live active-symbol poll, AI execution poll
- `RuntimeScanControlService` auto-scan (forced off)
- Full-watchlist `SymbolEnrichmentQueueService.schedule()`
- `PaperExecutionResearchHookService.connect()` (feed-driven probes)
- `SymbolService.subscribe()` on chart activation
- Live chart preload / `waitForSymbolReady` blocking

**Enabled:**

- Base symbol list (`GET /api/symbols?enrich=false`)
- On-demand enrich (`scheduleOnDemand`) for selected replay symbol
- Replay historical load (`loadHistoricalReplay`)
- REST candles/indicators for active symbol (no IBKR subscribe)

### Live debug mode

Toggle on research home or Replay Lab banner. Restores legacy dashboard orchestrator + scan + feeds + enrich-all behavior.

### Environment (`application-evolution` / `environment.evolution.ts`)

```properties
researchModeDefault: true
liveDebugAllowed: true
```

## Backend

No API removal — separation is **client routing and polling policy**. Flutter continues to use live/scanner/orchestration endpoints; Angular research routes use historical, replay, telemetry, analytics.

## Verify

1. `./start-evolution.sh` → open `http://localhost:4300/` (home, not live dashboard)
2. Replay Lab loads without 143-symbol enrich storm; network tab shows no `/symbols/subscribe` on load
3. Execution Review loads independently
4. Live debug: enable toggle → Replay Lab shows broker panel + polling resumes
