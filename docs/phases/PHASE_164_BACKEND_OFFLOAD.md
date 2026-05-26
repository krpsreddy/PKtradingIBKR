# Phase 164 — Backend Intelligence Offload + Performance Stabilization

**Status:** Implemented

Moves heavy intelligence computation to Spring Boot snapshot pipelines. Frontend becomes a lightweight visualization layer.

## Backend APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/live-regime/{symbol}` | Precomputed regime classification + opportunities |
| `GET /api/execution-cards/{symbol}` | Actionable execution cards with entry zones |
| `GET /api/replay-trigger/{symbol}/{session}` | Session trigger moments + markers |
| `GET /api/replay-timeline/{symbol}/{session}` | Full bar-level snapshot timeline |

## Backend Module

`src/main/java/com/tradingbot/intelligence/snapshot/`

- `IntelligenceScoringEngine` — regime + trigger scoring (Phase 162/163 logic)
- `IntelligenceSnapshotService` — reads `EvaluatedSignalSnapshotEntity`, precomputes snapshots
- `IntelligenceOffloadController` — REST endpoints

## Frontend Offload Layer

`frontend/src/app/services/intelligence-offload/`

- `intelligence-offload.config.ts` — `enabled: true`, `skipFrontendSynthesis: true`
- `intelligence-snapshot-api.service.ts` — HTTP client
- `intelligence-offload.service.ts` — cache + revision guard
- `replay-intelligence-cache.service.ts` — video-playback replay markers

## Performance Fixes

- **Lazy enrichment** — skips ~20 synthesis `refresh()` calls when offload enabled
- **`bindRevisionRefresh`** — synthesis services skip `store.revision$` fan-out
- **Replay scrubber** — `debounceTime(32)` + `distinctUntilChanged` on `currentIndex$`
- **Chart markers** — precomputed backend markers when timeline cached
- **Replay panel** — `ChangeDetectionStrategy.OnPush`
- **Dashboard** — already OnPush; prefetches backend snapshots per symbol
- **CDK virtual scroll** — replay timeline, decisions, scores; signal explorer rows
- **Chart marker cache** — replay markers memoized per session/cursor (no rebuild every tick)
- **Execution decision synthesis** — skips `revision$` fan-out when offload enabled
- **Global Edge Lab** — prefetches backend snapshots for focus symbol on refresh

## Architecture

```
Backend (Spring Boot)          Frontend (Angular)
─────────────────────          ──────────────────
EvaluatedSignalSnapshot   →    HTTP fetch only
IntelligenceScoringEngine      Render cards/overlays
Precomputed markers            Cursor scrub (no rescoring)
```

## Safety

Advisory only. No auto-trading or threshold mutation.
