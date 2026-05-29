# Phase 212 — Data Integrity & Recovery Engine

Execution safety infrastructure (not strategy expansion). Protects live intelligence from stale ticks, missing candles, IBKR reconnects, and partial rebuild state.

## Package layout

`com.tradingbot.dataintegrity`

| Subpackage | Components |
|------------|------------|
| `integrity/` | `RuntimeIntegrityState`, `IntegrityStateManager`, `DataIntegrityScore` |
| `continuity/` | `CandleContinuityValidator` |
| `staleness/` | `StaleDataDetector` |
| `recovery/` | `GapRecoveryService`, `ReconnectRecoveryCoordinator`, `RecoveryDowntimePolicy`, `HistoricalGapBackfillService` |
| `rebuild/` | `RollingStateRebuildEngine` |
| `health/` | `MarketDataHealthMonitor` |
| `telemetry/` | `DataIntegrityTelemetryService` → `data_integrity_telemetry` (integrity events) |

Root: `DataIntegrityEngine`, `ExecutionSafetyIntegrator`, `DataIntegrityController`, `DataIntegrityConfig`

## Runtime states

`RuntimeIntegrityState`: LIVE, DELAYED, STALE, DEGRADED, RECOVERING, DISCONNECTED

During **RECOVERING** (and STALE/DEGRADED/DISCONNECTED):

- Block auto execution, lifecycle transitions, adaptive exits, queue promotion
- Allow monitoring, telemetry, async rebuild

## Recovery flow

1. Disconnect tracked (`IntegrityStateManager.markDisconnected`)
2. Reconnect → `RECOVERING` + `GapRecoveryService.backfillAndRebuild`
3. IBKR `reqHistoricalData` short window (30–60m via `HistoricalGapBackfillService`)
4. `RollingStateRebuildEngine` — VWAP, RVOL, scanner rolling state, PM snapshot refresh
5. Wait `live.integrity.recovery-stabilization-candles` valid closes → **LIVE**

## Downtime policy

| Duration | Strategy |
|----------|----------|
| &lt;15 min | Backfill + continue |
| 15–60 min | Partial rebuild |
| &gt;60 min (same day) | Full lifecycle reset |
| New session day | Fresh bootstrap |

## Config (`application-evolution.properties`)

```properties
live.integrity.max-stale-seconds=10
live.integrity.max-delayed-seconds=20
live.integrity.max-candle-gap=1
live.integrity.recovery-stabilization-candles=2
live.integrity.health-poll-ms=5000
live.recovery.backfill-minutes=30
live.recovery.partial-rebuild-minutes=60
```

## Integrations

- `ExecutionSafetyService` — auto entry blocked via `ExecutionSafetyIntegrator`
- `PortfolioOrchestrationService` — frozen when `!allowsExecution()`
- `PaperExecutionExitService` — adaptive exits blocked during recovery-sensitive states
- `LiveScannerService` — regime mutation freeze + conviction multipliers
- `BrokerConnectionManager` → `ReconnectRecoveryCoordinator`

## API & mobile

- `GET /api/live-trader/data-integrity` — state, score, issues
- `GET /api/live-trader/data-integrity/events` — recent integrity events
- Monitor tab: `IntegrityBadge` (LIVE / DELAYED / STALE / RECOVERING)

## Phase 213

Premarket intelligence (9:00–9:30 ET) is implemented as **Phase 211** (`com.tradingbot.sessionintelligence`). No duplicate work required.
