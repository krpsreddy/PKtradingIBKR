# Phase 203 — 60-Day Regime Intelligence (Autonomous Discovery)

Empirical execution intelligence from paper telemetry and decision traces — **discovery only**, no auto-optimization of live gates.

## Backend (`com.tradingbot.discovery`)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/discovery/regime-intelligence?days=60` | Full report (cached 60s) |
| `GET /api/discovery/regime-performance` | Top regimes |
| `GET /api/discovery/market-structure-fit` | Regime × structure matrix |
| `GET /api/discovery/entry-quality` | Entry grade comparison |
| `GET /api/discovery/exit-quality` | Exit type monetization |
| `GET /api/discovery/continuation-capture` | Capture by dimension |
| `GET /api/discovery/session-analysis` | Session buckets |
| `GET /api/discovery/sector-analysis` | Sector clusters |
| `GET /api/discovery/bearish-analysis` | PUT assist states |
| `GET /api/discovery/failure-clusters` | Common loss patterns |
| `GET /api/discovery/decision-trace-analysis` | Trace category counts |

Lookback: `7`, `30`, `60` (default), `90` days.

## Data sources

- `execution_telemetry` (closed trades)
- `decision_trace` (entry/exit/suppression/PUT assist)
- `orchestration_telemetry`
- `bearish_assist_telemetry`
- `paper_execution_records` (second-leg flags)

## Angular

Autonomous Discovery Lab → tab **60-Day Regime Intelligence** (`RegimeIntelligence60dComponent`).

## Safety

Does not modify ranking, gates, or position sizing. Insights require human review before execution changes.
