# Phase 214 — Pine Script Bearish Intelligence Integration

Structural downside intelligence in `PK_Autonomous_Strategy_Planner.pine`, aligned with backend Phase 209/202 bearish ops (not inverse bullish / not RSI shorts).

## Scripts

| File | Role |
|------|------|
| `PK_Autonomous_Strategy_Planner.pine` | Strategy + backtest telemetry |
| `PK_Autonomous_Regime_Engine.pine` | Indicator overlay (same bearish scores/tags; no orders) |

Settings group **Bearish Intelligence (Phase 214)** on both.

## Scores (0–100)

| Score | Purpose |
|-------|---------|
| `reclaimFailureScore` | Failed reclaim structure |
| `rejectionPersistenceScore` | Lower highs, VWAP rejects, weak bounces |
| `breakdownAccelerationScore` | Downside velocity, body expansion, downside RVOL |
| `distributionPersistenceScore` | Distribution candles / weak upside |
| `squeezeRiskScore` | Anti-short-trap (extension, oversold, reversal wicks) |
| `bearishBiasScore` | Composite explainable bias |
| `bearishEnvironment` | FAVORABLE / NEUTRAL / HOSTILE proxy |

## PUT grades

`PUT_A_PLUS`, `PUT_A`, `PUT_B`, `AVOID` — mirrors `PutAssistGradeEvaluator` thresholds (configurable).

## Long suppression

`NONE` → `WARNING` → `DOWNGRADE` → `BLOCK`

- **BLOCK** + **HIGH** directional conflict → no new long entries
- Tags: `LONG BLOCKED`, `HIGH CONFLICT`

## Bearish lifecycle

`FAILED_RECLAIM`, `BREAKDOWN_CONFIRMATION`, `DISTRIBUTION_ACCELERATION`, `PANIC_EXPANSION`, `EXHAUSTION_BOUNCE`

## Premarket (optional)

9:00–9:30 ET only: PM VWAP rejection, failed gap boost (no overnight engine).

## Execution integration

- Long entries gated when `longBlocked` or `directionalConflict == HIGH`
- **COLLAPSING** partial exit when deterioration active in-trade
- Persistence trail tightens on rejection/breakdown scores

## Visuals (sparse)

`PUT A+`, `FAILED RECLAIM`, `LONG BLOCKED`, `COLLAPSING`, `HIGH CONFLICT` — purple/orange/red tags.

## Dashboard rows

Bear Bias, PUT Grade, Reclaim Fail, Reject Persist, Breakdown, Squeeze Risk, Long Supp, Conflict.

## Alerts

`PUT_A_PLUS`, `FAILED_RECLAIM`, `LONG_BLOCKED`, `HIGH_CONFLICT`, `COLLAPSING`, `PM_DISTRIBUTION`

## Backtest telemetry (hidden plots)

`TelLongSuppressed`, `TelPutAplus`, `BearishBias`, etc. — export from Data Window for replay research.

## Setup

1. Add **PK Autonomous Strategy Planner** as Strategy on 5m chart.
2. Enable **Bearish Intelligence** group.
3. Use Strategy Tester — compare long entries before/after suppression.

See `scripts/tradingview/README.md`.
