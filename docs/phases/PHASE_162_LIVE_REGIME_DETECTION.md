# Phase 162 — Live Regime Detection Engine

**Status:** Implemented · Advisory only

Real-time classification of market state into continuation regimes before expansion fully completes.

## Core Discovery

Big winners often skip deep pullbacks — they persist above VWAP with sustained RVOL and shallow digestion. Legacy governance over-penalizes this acceleration persistence.

## Module

`frontend/src/app/services/live-regime-intelligence/`

| File | Role |
|------|------|
| `live-regime.models.ts` | Regime types, metrics, report |
| `continuation-regime.engine.ts` | Regime type detection |
| `institutional-acceleration.engine.ts` | Acceleration integrity |
| `persistence-detection.engine.ts` | Continuation persistence score |
| `regime-transition.engine.ts` | Transition warnings |
| `expansion-probability.engine.ts` | Expansion / exhaustion probability |
| `pullback-depth.engine.ts` | Shallow pullback quality |
| `velocity-persistence.engine.ts` | RVOL + structure velocity |
| `breadth-confirmation.engine.ts` | Breadth / sector alignment |
| `live-regime-synthesis.service.ts` | Orchestrator |

## Live Regime Types

`EXPLOSIVE_CONTINUATION` · `EARLY_ACCELERATION` · `INSTITUTIONAL_PERSISTENCE` · `SHALLOW_PULLBACK_CONTINUATION` · `VWAP_ACCEPTANCE_PERSISTENCE` · `TREND_COMPRESSION_RELEASE` · `LATE_EXHAUSTION` · `RETAIL_CHASE_EXHAUSTION` · `CHOP_INSTABILITY`

## Classifications

`EXPLOSIVE_CONTINUATION` · `PERSISTENT_TREND` · `HEALTHY_PULLBACK` · `REACCELERATION_READY` · `EXTENDED_BUT_HEALTHY` · `LATE_STAGE_EXHAUSTION` · `CHOP_UNSTABLE`

## Metrics

- `continuationPersistenceScore`
- `accelerationIntegrity`
- `shallowPullbackQuality`
- `expansionProbability`
- `institutionalParticipationScore`
- `exhaustionProbability`
- `trendPersistenceProbability`

## Integration

- `ExecutionDecisionSynthesisService` — regime applied before opening/participation/autonomous overlays
- `LiveExecutionDecisionSnapshot.liveRegime` — advisory overlay on live decisions
- Replay chart — subtle green regime markers + hints on primary overlays
- Global Edge Lab — Live Regime Intelligence panel (8 sections)
- Execution rail — green regime participation line

## Safety

Strictly advisory. No auto-trading, threshold mutation, auto sizing, or governance removal.
