# Decision Engine

Phase 143 live execution decision architecture and overlay integration.

## Core components

| File | Role |
|------|------|
| `live-decision-engine.ts` | Single decision resolver |
| `execution-decision-synthesis.service.ts` | Builds context + calls engine |
| `live-decision.models.ts` | Decision types, context, quality reports |

## Decision resolution order (`resolveDecision`)

Priority stack (first match wins):

1. **Toxic governance / failed acceptance** → `TRAP_RISK` or `AVOID_TRADE`
2. **Conflict AVOID** → chase/trap/trade avoid
3. **Timing WAIT** → `WAIT_FOR_ACCEPTANCE` / `WAIT_FOR_PULLBACK`
4. **Too late** → `AVOID_CHASE` or `REDUCE_SIZE`
5. **Poor entry location** (Phase 146) → `TRAP_RISK` / `AVOID_CHASE`
6. **Non-ideal location + good narrative** → wait or probe (Phase 148 waitJustified)
7. **Overstated conviction** (Phase 148) → `REDUCE_SIZE`
8. **Conservative governance + stable narrative** (Phase 148) → probe/full when location ideal
9. **Reduce / low sustainability / extension** → `REDUCE_SIZE`
10. **Chase without strong continuation** → `AVOID_CHASE`
11. **Weak breadth + failing** → `AVOID_TRADE`
12. **High conviction + calibrated** (Phase 148) → `FULL_EXECUTION` if location ideal
13. **Moderate conviction** → `PROBING_EXECUTION`
14. **Low conviction** → `REDUCE_SIZE` / `AVOID_TRADE`

## Conviction bands

Scored by `execution-conviction.engine.ts`:

| Band | Typical score | Expected R (Phase 148 reference) |
|------|---------------|----------------------------------|
| ELITE | 85+ | 2.5R |
| HIGH | 75–84 | 2.1R |
| MODERATE | 55–74 | 0.8R |
| LOW | 40–54 | 0.3R |
| AVOID | <40 | -0.2R |

## LiveDecisionContext overlays

Built in `ExecutionDecisionSynthesisService.buildContext()`:

| Field | Source phase | Effect |
|-------|--------------|--------|
| `governanceState` | 137/138 | Toxic check |
| `sequencingState` | 142 | LIQUIDITY_SWEEP → trap |
| `fakeoutRisk` | 141 / false breakout | Trap elevation |
| `entryLocationQuality` | 146 | Location gates |
| `narrativeQuality` | 145 | Wait vs execute |
| `calibratedConvictionBias` | 148 | Over/under stated |
| `waitJustified` | 148 | Wait cost/benefit |
| `governanceTooConservative` | 148 | Aggression allowance |
| `narrativeStable` | 148 | Conviction downgrade |
| `calibrationRegretScore` | 148 | Full execution gate |
| `lowRegretZone` | 148 | Full execution gate |

## Historical quality report

`ExecutionDecisionSynthesisService.refresh()` produces `DecisionQualityReport`:

- By-decision expectancy and win rate
- Conviction accuracy rows
- Wait benefit from sequencing simulation
- Over-confidence detection (ELITE underperforming)

Embedded in Edge Refinement Lab as `decisionQuality`.

## Decision feedback loop (Phase 144)

`DecisionFeedbackEngine` re-runs `LiveDecisionEngine` on each historical signal:

- Records decision, conviction, outcome, correctness
- Includes `marketStatePath` for narrative context
- Powers wait-vs-act and regret analysis

## Safety

- Every snapshot: `advisoryOnly: true`
- `authoritative: sampleCount >= 10`
- No path triggers orders or modifies live signal thresholds

## Adding a new overlay (Phase 149+ pattern)

1. Add fields to `LiveDecisionContext` in `live-decision.models.ts`
2. Pass from new synthesis `liveIntel()` in `ExecutionAdvisoryAnalyticsService`
3. Wire in `buildContext()` in `execution-decision-synthesis.service.ts`
4. Add conditional branches in `LiveDecisionEngine.resolveDecision()`
5. Document in `docs/phases/PHASE_NNN.md`
