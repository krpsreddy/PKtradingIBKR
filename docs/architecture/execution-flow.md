# Execution Flow

End-to-end path from market data to execution rail guidance.

## 1. Data ingestion

```
IBKR Gateway (TWS)
    → HistoricalDataService (batch preload on connect)
    → CandleRepository → PostgreSQL `candles` table
    → Live market data subscriptions per watchlist symbol
```

## 2. Hydration (bulk 60D backfill)

```
Global Edge Lab → BulkHistoryHydrationService
    → Coverage scan: GET /symbols/{sym}/history-coverage
    → Bulk replay: GET /replay/bulk/{sym}?days=60
        → HistoricalReplayEngine.bulkReplay()
        → For each session date: bar-by-bar indicator calc + signal eval
    → bootstrapBulkFromReplay() → SignalIntelligenceStore
    → AnalyticsSyncService → POST /snapshots/bulk
    → HydrationStateService → PUT /hydration/{sym}
```

**Performance note:** Replay is CPU-bound (not a simple DB read). UI label "Downloading replay" means server-side replay compute.

## 3. Signal evaluation

```
SignalIntelligenceEngine.evaluateSnapshot()
    → WIN / LOSS / NEUTRAL from candle path vs entry/stop/target
    → Stored in SignalSnapshot.evaluation
```

## 4. Live advisory pipeline

```
Dashboard.refreshExecutionAdvisory()
    → ExecutionAdvisoryAnalyticsService.forSymbol(sym, ctx)
```

### Dependency order inside `forSymbol()`:

| Step | Phase | Output |
|------|-------|--------|
| 1 | Shared | Setup-regime matrix, false breakout, opening drive |
| 2 | Edge gate | Edge activation gate |
| 3 | Discovery | Execution edge gate |
| 4 | 137/138 | `LiveExecutionGateSnapshot` |
| 5 | 140 | `LifecycleCoachSnapshot` |
| 6 | 141 | `LiveExecutionQualityIntel` |
| 7 | 142 | `LiveEntrySequencingIntel` |
| 8 | 145 | `LiveMarketStateIntel` (uses sequencing) |
| 9 | 146 | `LiveAdaptiveEntryIntel` (uses market state) |
| 10 | 148 | `LiveAdaptiveCalibrationIntel` (uses narrative) |
| 11 | 143 | `LiveExecutionDecisionSnapshot` (consumes 137–148) |
| 12 | 144 | `LiveDecisionFeedbackIntel` |

## 5. Execution Panel rendering

```
ExecutionPanelComponent
    ├── liveDecision banner (143) — primary
    ├── marketStateIntel narrative (145) — meta override
    ├── adaptiveEntryLine (146)
    ├── adaptiveInsightLine (144)
    ├── calibrationLine (148)
    └── fallback: liveGate banner (137/138) + lifecycleCoach (140)
```

## 6. Lab / review surfaces

| Surface | Service | Phases aggregated |
|---------|---------|-------------------|
| Edge Refinement Lab | `EdgeRefinementReportService` | 141–148 |
| Playbook Lab | `PlaybookDiscoveryService` + calibration profiles | 139, 148 |
| Trade Timeline | `TradeLifecycleService` | 140, 145, 146, 148 |

## Architecture pattern for new phases

```
*.models.ts          → types + advisoryOnly: true
*.util.ts            → shared helpers, MIN_AUTHORITATIVE
*.engine.ts          → pure analyze(signals) / classifyLive(input)
*-synthesis.service.ts → refresh() + liveIntel() + report$ + store.revision$
```

Integrate via:
- **Lab:** add to `EdgeRefinementReportService.buildReport()`
- **Live:** add to `ExecutionAdvisoryAnalyticsService.forSymbol()` before/after live decision
- **Decision:** extend `LiveDecisionContext` + `LiveDecisionEngine.resolveDecision()`
