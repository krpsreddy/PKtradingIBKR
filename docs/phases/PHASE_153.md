# Phase 153 — Global Signal Explorer + Replay Navigation Workstation

## Goal

Transform replay from manual session browsing into a **historical execution intelligence navigator** — browse all signals across 60D and jump instantly into cached replay review at the exact signal candle.

## Module

`frontend/src/app/services/signal-explorer/`

| Engine / Service | Role |
|------------------|------|
| `SignalExplorerEngine` | Row formatting, labels, rank scores |
| `SignalExplorerFilterEngine` | Side/decision/narrative/quality/result/time filters |
| `SignalNavigationEngine` | Next/prev/elite/trap/reclaim/second-leg navigation |
| `SignalReviewLaunchEngine` | Build replay launch plan from signal record |
| `HistoricalSignalIndexEngine` | Dedupe, date index, 60D heatmap |
| `SignalClusteringEngine` | Repeated structure clusters |
| `SignalQualityRankingEngine` | Best/dangerous signal discovery sections |
| `SignalExplorerApiService` | HTTP client for search endpoint |
| `SignalExplorerSynthesisService` | Orchestrator + launch handler registration |

## Backend

`GET /api/analytics-storage/signals/search`

Query params: `symbol`, `from`, `to`, `decision`, `narrative`, `quality`, `result`, `page`, `size`

Response includes `replayReady`, `replayIndex`, `snapshotId` enriched from Phase 149 replay cache (no recomputation).

Service: `HistoricalSignalSearchService` — queries `evaluated_signal_snapshots`, enriches bar index from cached replay payload.

## UI

- **Review workspace tab:** Signal Explorer
- **Replay dock:** Collapsible panel above replay controls in execution workspace
- Filters, search, discovery sections, signal table, bulk review mode
- Optional 30-day heatmap timeline

## Click → Replay flow

1. `jumpToHistoricalSignal(plan)` in dashboard
2. Switch symbol / replay mode if needed
3. `ReplayWorkstationSynthesisService.loadSession()` — cache-first (Phase 149)
4. Set display mode **REVIEW**, seek to `replayIndex`, pause, center viewport
5. Signal inspection overlay via replay viewport engine

## Keyboard shortcuts (replay + explorer dock open)

| Key | Action |
|-----|--------|
| N | Next signal |
| P | Previous signal |
| E | Next elite signal |
| T | Next trap |
| R | Next reclaim |
| S | Next second leg |

## Constraints

- No replay recomputation
- No strategy/threshold mutation
- Advisory review workflow only

## Performance targets

- Signal explorer load: < 2s for 60D (500-row page, indexed DB query)
- Replay jump: < 500ms from cached snapshot
