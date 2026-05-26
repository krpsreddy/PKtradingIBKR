# Phase 156 — Analytics Query Workbench + Conviction Distribution

## Goal

Read-only observability over PostgreSQL `evaluated_signal_snapshots` (+ decision feedback enrichment) to diagnose over-suppression, low conviction, rare FULL_EXECUTION, and missed continuations.

## Backend — `com.tradingbot.analytics.query`

| File | Role |
|------|------|
| `AnalyticsQueryController` | REST endpoints |
| `AnalyticsQueryService` | Orchestrator |
| `AnalyticsQueryRepository` | Load + normalize rows |
| `AnalyticsDistributionEngine` | Conviction bands |
| `AnalyticsSummaryEngine` | Group stats + diagnostics A–J |
| `AnalyticsCrossMatrixEngine` | Decision × narrative matrix |

### Endpoints

- `GET /api/analytics-query/conviction-distribution`
- `GET /api/analytics-query/decision-stats`
- `GET /api/analytics-query/narrative-stats`
- `GET /api/analytics-query/quality-stats`
- `GET /api/analytics-query/result-stats`
- `GET /api/analytics-query/cross-matrix`
- `GET /api/analytics-query/diagnostics`
- `GET /api/analytics-query/workbench` — all panels in one call
- `GET /api/analytics-query/db-count`

**Query params:** `symbol`, `from`, `to`, `decision`, `narrative`, `quality`, `result`, `convictionBand`

### Conviction bands

| Band | Range |
|------|-------|
| ELITE | 90–100 |
| HIGH | 75–89 |
| MODERATE | 55–74 |
| LOW | 35–54 |
| AVOID | 0–34 |

## Frontend

Review → **Analytics Query** tab (`app-analytics-query-workbench`)

Panels:
1. Conviction histogram (band counts + WR/avgR)
2. Decision distribution
3. Narrative stats table (heatmap-style)
4. Diagnostic insights A–J
5. Quality + result stats
6. Decision × narrative cross matrix

## Non-goals

No strategy mutation, auto-calibration, or threshold changes.
