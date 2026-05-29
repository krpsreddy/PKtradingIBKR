# Phase 189 — Portfolio Orchestration Engine

Lightweight portfolio intelligence for autonomous paper execution (max **1** active position).

## Package

`com.tradingbot.livetrader.portfolio`

| Class | Role |
|-------|------|
| `PortfolioOrchestrationService` | Facade — refresh state, select execution candidate |
| `PortfolioDecisionEngine` | Per-opportunity decision rules |
| `CorrelationSuppressionEngine` | SEMIS / AI / EV / MEGA_TECH clusters |
| `OpportunityQueueService` | In-memory queue + 15m TTL |
| `PortfolioExposureModel` | Active slot snapshot |
| `OpportunityPriorityComparator` | Queue sort order |
| `OrchestrationTelemetryService` | Persist decisions to `orchestration_telemetry` |

## Rules (Phase 1)

- Max 1 active paper position
- No pyramiding, scaling, or auto-replacement
- Auto execute only when slot empty + passes gates
- Otherwise QUEUE / SUPPRESS / REPLACEMENT_CANDIDATE (advisory)

## API

`GET /api/live-trader/portfolio-state`

## Mobile

Trader tab → **PORTFOLIO** panel (active / queue / suppressed / replacement).
