# Phase 204 — Historical bulk discovery evolution

Upgrades **Autonomous Strategy Discovery Lab** with structured historical regime research (separate from execution telemetry in Phase 203).

## Two intelligence layers

| Layer | Source | Tab |
|-------|--------|-----|
| Historical bulk | `evaluated_signal_snapshots` | Historical Discovery |
| Execution telemetry | `execution_telemetry`, `decision_trace` | Execution Telemetry (60D) |

## Backend

`HistoricalBulkDiscoveryService` — paginated snapshot load, 5min cache, no replay-lab joins.

`GET /api/discovery/historical-bulk?days=60`  
`POST /api/discovery/historical-bulk/refresh?days=60` — cache bust

Sections: regime discovery, family clusters, market structure, continuation profiles, failure clusters, sector DNA, session behavior, trend maturity, regime evolution, **historical vs live** gap, `DiscoveryConfidenceScore`, insights.

## UI refactor

- Removed verbose discovery tab (stacked tables, governance wall, replay dump)
- Primary tab: **Historical Discovery** (structured cards + compact tables)
- **Execution Telemetry (60D)** unchanged (Phase 203)
- Explainable / Exit Validation lazy-loaded

## Safety

Research only — does not auto-modify execution gates or thresholds.
