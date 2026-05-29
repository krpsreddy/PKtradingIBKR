# Phase 205 — Data Integrity & Recovery Engine

Execution safety layer: execution intelligence runs only on trusted live data. Replay Lab bypasses all integrity gates.

## Module (`com.tradingbot.dataintegrity`)

| Component | Role |
|-----------|------|
| `IntegrityState` | LIVE, DELAYED, STALE, DEGRADED, RECOVERING, DISCONNECTED |
| `DataIntegrityEngine` | Score (0–100), global assessment, stabilization |
| `CandleContinuityValidator` | Missing/duplicate/out-of-order 5m bars |
| `StaleDataDetector` | Frozen price, tick age |
| `MarketDataHealthMonitor` | Scheduled lightweight poll (live only) |
| `GapRecoveryService` | Async VWAP/RVOL/rolling cache rebuild after reconnect |
| `IntegrityStateManager` | Global + per-symbol state |
| `ExecutionSafetyIntegrator` | Execution + regime freeze gates |
| `ReconnectRecoveryCoordinator` | Broker disconnect/ready hooks |
| `DataIntegrityTelemetryService` | Persisted `data_integrity_telemetry` events |

## Configuration (`application-evolution.properties`)

- `live.integrity.max-stale-seconds=10`
- `live.integrity.max-candle-gap=1`
- `live.integrity.recovery-stabilization-candles=2`
- `live.integrity.health-poll-ms=5000`

## Execution blocks (STALE / DEGRADED / DISCONNECTED / RECOVERING)

- `ExecutionSafetyService.checkAutoEntry()`
- `PortfolioOrchestrationService` refresh / select
- `PaperExecutionExitService` adaptive exits
- Rolling dominance/conviction updates frozen when `freezeRegimeMutation()`

## Confidence degradation

- DEGRADED/STALE: 0.75 multipliers on dominance, conviction, persistence
- RECOVERING/DISCONNECTED: 0.5

## API

- `GET /api/live-trader/data-integrity`
- `GET /api/live-trader/data-integrity/events`

## Mobile

- `IntegrityBadge` on Monitor screen (ops payload: `dataIntegrityState`, `dataIntegrityScore`)

## Restart

```bash
./start-evolution.sh
```
