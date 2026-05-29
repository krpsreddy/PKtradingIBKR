# Phase 190 — Execution Review Workspace

Post-market execution intelligence on the **Angular research platform only** (not Flutter mobile).

## Backend

Package: `com.tradingbot.executionreview`

| Class | Role |
|-------|------|
| `ExecutionReviewController` | REST API |
| `ExecutionReviewService` | Aggregation |
| `EntryQualityReviewEngine` | IDEAL / EARLY / CHASED / EXTENDED / WEAK / LATE |
| `ExitQualityReviewEngine` | OPTIMAL / PREMATURE / MISSED_SECOND_LEG / … |
| `ContinuationCaptureEngine` | Capture %, MFE, second-leg, trail efficiency |
| `ExecutionNarrativeEngine` | Human-readable execution story |

### APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/execution-review/daily-summary?date=` | Session summary cards |
| `GET /api/execution-review/trades?date=&regime=&…` | Trade grid + filters |
| `GET /api/execution-review/regime-performance?date=` | Per-regime stats |
| `GET /api/execution-review/continuation-capture?date=` | Continuation monetization |
| `GET /api/execution-review/queue-analysis?date=` | Queue vs active / suppressions |
| `GET /api/execution-review/session-analysis?date=` | Session period context |

Data sources: `execution_telemetry`, `orchestration_telemetry`.

## Frontend

Route: `#/execution-review`

```
frontend/src/app/execution-review/
  execution-review.component.{ts,html,scss}
  execution-review.routes.ts
  execution-review.module.ts
frontend/src/app/services/execution-review/
  execution-review-api.service.ts
  execution-review.models.ts
```

Replay: **Open synchronized replay** → `ReplayLaunchIntentService` → `/dashboard`.

## Mobile

No execution review UI in Flutter — operational terminal only.
