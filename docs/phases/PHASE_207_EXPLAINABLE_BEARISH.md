# Phase 207 — Explainable Bearish Regime Intelligence

Dual-sided Explainable Regimes tab with parity to bullish continuation explainability.

## UI

Inside **Explainable Regimes**:

- Subtabs: **Bullish Explainability** (default) · **Bearish Explainability**
- Bullish: green/teal styling (unchanged)
- Bearish: red/orange/purple breakdown styling

## Frontend module (`services/explainable-regimes/bearish/`)

| File | Role |
|------|------|
| `bearish-regime.models.ts` | Bearish types, squeeze, PUT grade, lifecycle |
| `bearish-regime-threshold-engine.ts` | Numeric thresholds & formulas |
| `bearish-cluster-classifier.ts` | Filter + `FAILED_RECLAIM_CLUSTER_###` naming |
| `bearish-execution-reasoning.engine.ts` | Triggered / invalidates / structure / lifecycle |
| `bearish-regime-explanation.service.ts` | Strategy explain + historical API bridge |

## Bearish clusters

Examples: `FAILED_RECLAIM_CLUSTER_*`, `VWAP_REJECTION_CLUSTER_*`, `BREAKDOWN_ACCEL_CLUSTER_*`, `PANIC_EXPANSION_CLUSTER_*`, etc.

## Each cluster explains

- **Triggered because** — reclaim failure, rejection persistence, downside acceleration, sector weakness
- **Invalidates if** — strong reclaim, squeeze risk, failed persistence, exhaustion bounce
- **SqueezeRiskScore** — LOW / MODERATE / HIGH / CRITICAL
- **PUT entry grade** — IDEAL_BREAKDOWN, FAILED_RECLAIM, PANIC_CHASE, SQUEEZE_RISK, etc.
- **Structure score** — rejection, weak reclaim, RVOL, market weakness − squeeze penalty
- **Lifecycle path** — FAILED_RECLAIM → BREAKDOWN_CONFIRMATION → … → EXHAUSTION_BOUNCE

## Discovery integration

When mined strategies contain few bearish clusters, the explainer supplements from:

`GET /api/discovery/historical-bulk/bearish` (Phase 206 regime families → synthetic strategies).

## Architecture notes

- Same cached client-side pattern as Phase 170 (no heavy replay queries)
- Ready for future PUT execution intelligence without refactor
