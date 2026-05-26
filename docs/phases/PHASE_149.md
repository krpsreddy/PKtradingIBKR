# Phase 149 — Incremental Replay + Precomputed Analytics Cache

## Goal

Eliminate expensive full-history replay during hydration via **cache-first incremental replay** — performance and infrastructure only. No analytics behavior changes.

## New Backend Module

**Package:** `com.tradingbot.replay.cache`

| Component | Role |
|-----------|------|
| `ReplaySessionSnapshotEntity` | Persist full replay payload per symbol/session |
| `ReplaySessionMetadataEntity` | Track freshness, hashes, replay duration |
| `ReplayHashUtil` | SHA-256 candles hash |
| `ReplayStalenessService` | Validity checks (hash + analyticsVersion) |
| `ReplaySnapshotService` | Load/persist snapshots |
| `IncrementalReplayService` | Cache-first bulk replay |
| `ReplayCacheQueryService` | Snapshot summary queries |
| `ReplayCacheController` | REST API |

## API

```
GET  /api/replay-cache/snapshot/{symbol}
GET  /api/replay-cache/snapshot/{symbol}/{sessionDate}
GET  /api/replay-cache/sessions/{symbol}
GET  /api/replay-cache/stale-sessions/{symbol}
POST /api/replay-cache/incremental-replay/{symbol}?days=60&force=false
```

## New Frontend Module

**Path:** `frontend/src/app/services/signal-intelligence/replay-cache/`

| Service | Role |
|---------|------|
| `replay-cache-api.service.ts` | Backend API client |
| `replay-snapshot-store.service.ts` | localStorage snapshot cache |
| `incremental-hydration.service.ts` | Cache-first hydrate flow |
| `lazy-analytics-enrichment.service.ts` | Defer Edge Lab + Playbook refresh |

## Hydration Flow (New)

1. Load replay snapshots (cache/API)
2. Validate analyticsVersion + candles hash
3. Replay **only** stale/missing sessions
4. Evaluate new signals (unchanged logic)
5. Background enrich advanced analytics

## Optimizations

| Optimization | Location |
|--------------|----------|
| O(n²) `indexOf` removed | `HistoricalReplayEngine.replaySession()` — indexed loop |
| Single candle load per symbol | `bulkReplay()` + `IncrementalReplayService` |
| Precomputed indicators in snapshot | `indicatorSnapshotJson` on persist |
| Adaptive worker pool | `HistoricalHydrationQueueService` — scales 2–6 workers |
| Priority symbol first | `BulkHydrationOptions.prioritySymbol` |
| Updated UI labels | No more "Downloading replay…" |

## Integrations

- `SymbolEdgeAnalysisService.backfillFromStoredHistory()` → incremental API
- `BulkHistoryHydrationService` → new phase labels + lazy enrichment on completion
- Legacy fallback: `GET /replay/bulk/{symbol}` if incremental fails

## Staleness Rules

Snapshot is **STALE** when:
- `analyticsVersion` mismatch
- `candlesHash` changed
- Status not `READY`

## Safety Constraints

- No strategy mutation
- No threshold mutation
- No auto-trading
- Same signal evaluation pipeline — only replay compute is cached
- First full hydration still allowed to take minutes; subsequent loads target <10s

## Performance Targets

| Scenario | Target |
|----------|--------|
| First full hydration | Several minutes (acceptable) |
| Subsequent app open | <10 seconds |
| Cache hit (all READY) | Near-instant snapshot load |

## Key Discoveries

- Bulk replay cost was ~99% redundant when candles unchanged
- Backend-side cache eliminates large JSON transfer on cache hits
- Lazy enrichment prevents Edge Lab matrices from blocking hydration UI
