# Phase 138 — Confidence-Weighted Execution Governance

## Goal

Layer **statistical capital governance** on Phase 137 — confidence-weighted suppression with size multipliers based on sample depth and expectancy.

## New Engines

| Engine | Role |
|--------|------|
| `confidence-weighted-suppression.engine.ts` | Sample-weighted suppression strength |
| `execution-governance-synthesis.engine.ts` | Governance state + confidence band |

**Models:** `ConfidenceWeightedSuppression`, `StatisticalConfidenceBand` in `live-execution.models.ts`

**Orchestrated inside:** `LiveExecutionGateService` (Phase 137/138 orchestrator)

## Statistical Floors

```typescript
MIN_SUPPRESS_SAMPLES = 10   // below: advisory only, no hard suppression
MIN_TOXIC_SAMPLES = 40
MIN_TOXIC_EXPECTANCY = -0.75
```

## Integrations

- `liveGate.governance` in Execution Panel
- Passed to Phase 143 as `governanceState` / `governanceConfidence`
- `governanceToxic()` check in `LiveDecisionEngine`

## Key Discoveries

- Insufficient samples must explicitly avoid authoritative suppression language
- TOXIC state requires both sample depth and negative expectancy threshold

## Safety Constraints

- `advisoryOnly: true`
- Below n=10: no hard suppression recommendations
- Size multipliers are advisory sizing hints only
