# Phase 193 — Replay Lab performance & long-running query optimization

## Problem

Replay Lab still stalled after Phase 192 because:

- Full replay session builds recompute indicators bar-by-bar (O(n²) work on cache miss)
- Multi-day context loaded 1–5 extra sessions per open (`PREVIOUS_DAY` / `WEEK_CONTEXT`)
- `bootstrapFromReplay` + intel cache preload on every session load
- `refreshReplayView` rebuilt execution overlays on every scrub tick
- No request-level visibility for slow replay APIs

## Backend

| Component | Purpose |
|-----------|---------|
| `ReplaySessionMemoryCache` | Caffeine LRU (48 sessions, 30m) for built `ReplayHistoryDto` |
| `ReplayRuntimeMode` | Active replay scope counter for live-runtime deferral |
| `ReplayRuntimeScopeFilter` | Sets replay scope on all `/api/replay*`, `/api/replay-cache*`, `/api/execution-review*` requests |

### Live runtime deferral (backend)

While `ReplayRuntimeMode.isReplayActive()`:

- `LiveScannerService` — no refresh / ensureFresh / bootstrap-on-activate
- `BackgroundHydrationOrchestrator` — no enqueue or scheduled drain
- `RuntimeBootstrapService` — no bootstrap, reconnect recovery, periodic refresh
- `NanoScannerScheduler` — no nano tick
| `ReplayRequestTimingFilter` | Logs `/api/replay*`, `/api/replay-cache*`, `/api/execution-review*` — WARN if &gt; 500ms |
| `HistoricalReplayEngine` | Memory cache + structured timing (db vs compute) |

### Slow SQL (evolution)

`application-evolution.properties`:

```properties
spring.jpa.properties.hibernate.session.events.log.LOG_QUERIES_SLOWER_THAN_MS=250
logging.level.org.hibernate.SQL_SLOW=WARN
```

Prefer **DB replay snapshots** (`/api/replay-cache/snapshot/{symbol}/{date}`) — avoids engine rebuild.

## Frontend

| Component | Purpose |
|-----------|---------|
| `ReplayPerformanceDiagnosticsService` | Request log, phases, slow count, heap hint |
| `replayPerformanceInterceptor` | HTTP timing + payload bytes for replay URLs |
| `ReplayPerformancePanelComponent` | Dev panel (bottom-right, when `showNetworkDiagnostics`) |

### Replay Lab isolation (research mode)

- **No prior-session waterfall** — `loadPriorContext: false` when `ResearchModeService.isResearch()`
- **Default context** — `INTRADAY_ONLY` (not `PREVIOUS_DAY`)
- **Deferred overlays** — `refreshReplayView` throttled (48–120ms); index debounce 100ms
- **Signal bootstrap** — `queueMicrotask` in research; skipped intel preload unless live debug
- **No** `bootstrapFromReplay` blocking path on cache hit

## Targets

| Metric | Target |
|--------|--------|
| Session load (cache hit) | &lt; 500ms |
| Session load (miss, warm memory) | &lt; 2s |
| Scrub step | &lt; 150ms perceived (throttled UI) |

## Verify

1. Open `http://localhost:4300/replay-lab`
2. Expand **Replay diagnostics** — should show few requests, no duplicate storm
3. Backend log: `REPLAY_REQ` / `Replay memory cache HIT` on repeat opens
4. Network tab: no `/symbols/subscribe`, no scanner poll in research mode

## Live debug

Enabling **Live debug** restores prior multi-day context and live orchestration for comparison only.
