# Phase 211 — Premarket Intelligence Engine

Session-aware structural context for **9:00–9:30 AM ET** only. Not a 4am overnight engine, not PM execution.

## Package

`com.tradingbot.sessionintelligence`

- `premarket/` — engine, snapshot DTO, trend classifier, persistence, RVOL
- `session/` — `PremarketSessionWindow`, `OpenTransitionEngine`
- `gap/` — `PremarketGapAnalysisEngine`
- `vwap/` — `PremarketVWAPEngine`
- `context/` — `PremarketCandleRollingStore` (in-memory, same day)
- `telemetry/` — `premarket_intelligence_snapshot` table

## Config (`application-evolution.properties`)

```properties
session.premarket.enabled=true
session.premarket.telemetry-enabled=true
```

## API

- `GET /api/session/premarket/window`
- `GET /api/session/premarket/{symbol}`
- `GET /api/session/premarket/snapshots`

## Integrations

| Consumer | Behavior |
|----------|----------|
| `TradingPipelineService` | Ingests candles into rolling PM store (9:00–9:30 bars) |
| `PremarketIntelligenceScheduler` | Refreshes watchlist every 30s in active window |
| `MarketStructureEngine` | Symbol-level bullish conviction modifier |
| `BearishMarketAlignmentEngine` | PM bearish cluster % on watchlist |
| `BearishOperationalService` | Suppression, bearish bias, scanner chips |
| `PutAssistEvaluator` | PM bearish bias boost + reasons |
| `LiveScannerService` | PM refresh + rank boost (`PM CONTINUATION`, `FAILED GAP`) |
| `ExecutionIntelligenceCoordinator` | PM-aware structure conviction |

## Mobile

`bearishOps.premarketChip` — optional chips: PM STRONG, PM WEAK, FAILED GAP, PM DISTRIBUTION (via `OpportunityAccent.chips`).

## Safety

No trade execution during premarket. Intelligence only; RTH execution unchanged.

## Telemetry

`premarket_intelligence_snapshot` — summarized structure, gap quality, persistence, open transition outcome (no raw PM candles).
