# Analytics Persistence

Phase 147 architecture — PostgreSQL-backed intelligence storage.

## Strategy

| Layer | Role |
|-------|------|
| PostgreSQL | Source of truth |
| localStorage | Cache + offline fallback |
| Server wins | On bootstrap conflict resolution |

## Frontend services

### `AnalyticsSyncService`

Bootstraps on app load:

1. `GET /version` — check `analyticsVersion`, stale flag
2. Load evaluated snapshots (paginated, 500/page)
3. `store.mergeFromServer()` if server has data
4. Else migrate localStorage → `POST /snapshots/bulk`
5. `hydrationState.bootstrapFromBackend()`
6. Load playbook candidates → `playbookStore.importFromServer()`

Debounced sync: 2s after store revision → chunk upsert (200 signals/chunk).

### `AnalyticsStorageApiService`

REST client for all `/api/analytics-storage/*` endpoints.

### `HydrationStateService`

Persists per-symbol hydration metadata after bulk hydration completes.

### `PersistentEvaluatedSignalService`

Paginated load of evaluated signal snapshots from backend.

## Backend entities

| Table | Entity | Key fields |
|-------|--------|------------|
| `evaluated_signal_snapshots` | `EvaluatedSignalSnapshotEntity` | `signalId` (unique), `symbol`, `payload` (JSON), indexed denormalized fields |
| `hydration_sessions` | `HydrationSessionEntity` | `symbol` (unique), lookback, status, session dates |
| `playbook_candidates` | `PlaybookCandidateEntity` | `candidateId`, `candidateKey`, `payload` |
| `decision_feedback_snapshots` | `DecisionFeedbackSnapshotEntity` | `signalId`, `payload` |

## Version handling

```java
AnalyticsVersionService.CURRENT_VERSION = 1
```

- Frontend: `ANALYTICS_STORAGE_VERSION = 1`
- Bulk upsert skips incompatible client versions
- `stale: true` when server version ahead of client

## API summary

```
GET  /api/analytics-storage/version
GET  /api/analytics-storage/stats
GET  /api/analytics-storage/snapshots?page=&size=&symbol=&fromTs=
POST /api/analytics-storage/snapshots/bulk
GET  /api/analytics-storage/hydration
GET  /api/analytics-storage/hydration/{symbol}
PUT  /api/analytics-storage/hydration/{symbol}
GET  /api/analytics-storage/playbook-candidates
POST /api/analytics-storage/playbook-candidates/bulk
POST /api/analytics-storage/decision-feedback/bulk
```

## Hibernate DDL

`spring.jpa.hibernate.ddl-auto=update` — tables auto-created on backend start.

## localStorage keys (cache)

| Key | Contents |
|-----|----------|
| `pk-signal-intelligence-v1` | Signal snapshots cache |
| `symbol-history-hydration-v1` | Hydration state cache |
| `symbol-history-hydration-queue-v1` | Transient queue (cleared on load) |

## Future improvements

- Backend incremental replay (skip already-evaluated session dates)
- Precomputed replay snapshot cache in PostgreSQL
- Sync status indicator in Edge Lab UI
