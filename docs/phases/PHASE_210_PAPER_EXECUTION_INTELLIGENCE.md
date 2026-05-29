# Phase 210 — Execution Order Intelligence (Paper Mode)

## Goal

Upgrade paper execution from instant market simulation to **realistic execution intelligence** — still **no live IBKR order placement** when simulated mode is on.

## Package

`com.tradingbot.execution.paperintelligence`

| Subpackage | Components |
|------------|------------|
| `entry/` | `AdaptiveLimitEntryEngine`, `EntryExecutionPlan` |
| `fills/` | `PaperFillSimulationEngine`, `PaperFillResult` |
| `stop/` | `StructuralInitialStopEngine`, `StructuralStopPlan` |
| `trailing/` | `StructuralTrailingStopEngine`, `TrailingStopPlan` |
| `quality/` | `ExecutionDeteriorationEngine`, `StaleEntryProtectionEngine`, `OrderTimeoutEngine`, `ExecutionQualityScoringEngine` |
| `telemetry/` | `PaperExecutionTelemetryService`, `ContinuationCaptureAnalyticsEngine` |
| `simulation/` | `PaperExecutionIntelligenceCoordinator`, `PaperExecutionIntelligenceStateStore` |
| `api/` | Review REST endpoints |

## Configuration (evolution)

```properties
paper-execution.intelligence-enabled=true
paper-execution.simulated-fills-only=true
```

When `simulated-fills-only=true`, `PaperExecutionResearchService` **does not** call `PaperOrderPlacementService` — fills are simulated.

## Flow

```
signal → adaptive limit plan → stale/timeout gates → fill simulation
→ structural stop → OPEN → lifecycle trailing + deterioration poll → adaptive exit
→ expanded telemetry → review APIs
```

## APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /api/execution/review` | Summary |
| `GET /api/execution/trailing-analysis` | Trail states |
| `GET /api/execution/fill-quality` | Fill grades |
| `GET /api/execution/slippage-analysis` | Slippage stats |
| `GET /api/execution/continuation-capture` | Capture by lifecycle |
| `GET /api/execution/premature-exits` | Early exits |

## Telemetry

`execution_telemetry` extended with fill probability, slippage, latency, deterioration, trailing efficiency, capture %, premature/overstayed flags, execution grades.

`paper_execution_records` extended with limit/stop/trail prices, fill quality, `simulated_fill` flag.

## Integration

- `LiveTraderAutoExecutionHook` — passes ranked opportunity into `submitProbe`
- `PaperExecutionResearchService` — simulated entry path
- `PaperExecutionExitService` — structural trail exits for simulated positions
- `ExecutionRefinementEngine` — uses `ContinuationCaptureAnalyticsEngine`
