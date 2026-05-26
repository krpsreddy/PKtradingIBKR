# Phase 147 — Persistent Analytics Storage Layer

## Goal

Move evaluated intelligence from browser `localStorage` to **persistent PostgreSQL** — migration strategy keeps localStorage as cache, backend as source of truth.

## New Components

### Frontend — `persistent-analytics/`

| File | Role |
|------|------|
| `analytics-storage-api.service.ts` | REST client for `/api/analytics-storage` |
| `analytics-sync.service.ts` | Bootstrap, migration, debounced sync |
| `hydration-state.service.ts` | Persist hydration metadata |
| `persistent-evaluated-signal.service.ts` | Paginated signal load |
| `analytics-storage.models.ts` | Version, sync state types |

### Backend — `com.tradingbot.analytics.storage/`

| Layer | Files |
|-------|-------|
| API | `AnalyticsStorageController.java` |
| Services | `AnalyticsPersistenceService`, `AnalyticsQueryService`, `AnalyticsVersionService` |
| Entities | `EvaluatedSignalSnapshotEntity`, `HydrationSessionEntity`, `PlaybookCandidateEntity`, `DecisionFeedbackSnapshotEntity` |

## REST Endpoints

```
GET  /api/analytics-storage/version
GET  /api/analytics-storage/stats
GET  /api/analytics-storage/snapshots
POST /api/analytics-storage/snapshots/bulk
GET  /api/analytics-storage/hydration
PUT  /api/analytics-storage/hydration/{symbol}
GET  /api/analytics-storage/playbook-candidates
POST /api/analytics-storage/playbook-candidates/bulk
```

## Integrations

- App init: `AnalyticsSyncService.bootstrap()` on store revision
- `SignalIntelligenceStore.mergeFromServer()` — server wins conflicts
- `PlaybookCandidateStore.importFromServer()`
- `BulkHistoryHydrationService` persists hydration via `HydrationStateService`
- Playbook discovery auto-persists on refresh

## Key Discoveries

- First hydration still requires full replay compute (local DB candles, not IBKR)
- Backend empty → migrates localStorage on first bootstrap
- `analyticsVersion = 1`; stale flag on version mismatch

## Safety Constraints

- Storage only — no trading side effects
- Bulk upsert is idempotent by signal ID
- Advisory analytics payloads only
