# Phase 188 — PK Live Trader Evolution (Execution Terminal)

Operational mobile-first execution intelligence — not a research dashboard.

## Backend (`com.tradingbot.livetrader.execution`)

| Component | Purpose |
|-----------|---------|
| `ExecutionQualityEngine` | LOW / MEDIUM / HIGH / INSTITUTIONAL |
| `TradeLifecycleEngine` | DEVELOPING → … → FAILED + velocity trend |
| `RegimeReliabilityEngine` | Live win-rate boost from closed telemetry |
| `ExecutionTelemetryService` | Persist every paper probe entry/exit |
| `ExecutionSafetyService` | Daily loss, consecutive losses, probe rate, kill switch |
| `LiveTraderOpportunityEnricher` | Enriches ranked DTOs for mobile hero/scanner |

## APIs

- `GET /api/live-trader/ops` — monitor tab (IBKR, scanner health, telemetry logs)
- `POST /api/live-trader/kill-switch` — emergency stop (scan off, auto off, flatten paper)
- `POST /api/live-trader/kill-switch/reset` — clear kill switch

## Auto paper gates (default)

- Top-1 ranked setup only
- Conviction ≥ 75, Dominance ≥ 120, Persistence ≥ 60, RVOL ≥ 1.5
- Lifecycle CONFIRMED or PERSISTING
- Blocks EXHAUSTION / FAILED / CHOP / LOW quality / stale quotes

## Mobile

- Hero: execution quality, dominance emphasis, velocity colors, stop/target/R, freshness
- Lifecycle ribbon under hero
- Kill switch on Trader tab
- Monitor: ops endpoint

## Config (`application-evolution.properties`)

```properties
live-trader.safety.max-daily-loss-r=3.0
live-trader.safety.max-consecutive-losses=4
live-trader.safety.max-open-positions=3
live-trader.safety.max-probes-per-hour=12
```
