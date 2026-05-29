# Phase 209 — Bearish Intelligence Operational Integration

## Goal

Move bearish intelligence from research-only discovery into the live execution flow **without** autonomous short selling or automatic PUT execution.

## Backend (`com.tradingbot.bearish`)

| Component | Role |
|-----------|------|
| `BearishLongSuppressionEngine` | NONE / WARNING / DOWNGRADE / BLOCK weak longs |
| `BullishDeteriorationEngine` | HEALTHY → COLLAPSING bullish weakening |
| `BearishOpportunityRanker` | Rank manual PUT structures |
| `DirectionalConflictEngine` | Bullish vs bearish conflict (HIGH suppresses auto) |
| `BearishMarketAlignmentEngine` | FAVORABLE / NEUTRAL / HOSTILE environment |
| `PutAssistGradeEvaluator` | A+, A, B, C, AVOID grades |
| `BearishOperationalService` | Coordinator: assess, overlay, suppression adjustments |
| `BearishOperationalTelemetryService` | Async `bearish_operational_trace` persistence |

## Integration points

1. **Before portfolio / auto execution** — `BearishOperationalService` via `LiveTraderOpportunityEnricher`; `PortfolioDecisionEngine` and `LiveTraderAutoExecutionHook` call `blocksAutoExecution()`.
2. **Adaptive exits** — `PaperExecutionExitService` uses `BullishDeteriorationLevel` (tighten on DETERIORATING, defensive close on COLLAPSING).
3. **Live scanner** — `LiveScannerService.enrichScanner()` adds `bearishBias`, suppression, deterioration, `operationalChip`.
4. **PUT assist** — `PutAssistEvaluator` + `BearishAssistService` emit `putAssistGrade`; operational overlay sets chips (PUT A+, LONG BLOCKED, etc.).

## Safety

- No auto short stock
- No auto buy puts
- Replay mode bypasses operational gates (`ReplayRuntimeMode`)

## Mobile (Flutter)

Lightweight chips on scanner rows (`operationalChip`) and hero hint when deterioration is DETERIORATING/COLLAPSING.

## Telemetry table

`bearish_operational_trace` — symbol, regime, suppression, deterioration, PUT grade, conflict, environment, structural metrics, narrative, timestamp.
