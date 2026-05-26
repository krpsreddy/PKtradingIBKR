# Narrative System

Phase 145 market state machine and narrative intelligence architecture.

## Purpose

Transform point-in-time signals into **evolving institutional narratives** — state paths, trajectories, flow types, and narrative playbooks that inform execution timing and aggression.

## Core components

| File | Role |
|------|------|
| `market-state-machine.engine.ts` | Derive state path per signal |
| `execution-narrative.engine.ts` | Human-readable narrative + rail line |
| `state-transition-expectancy.engine.ts` | Expectancy by transition path |
| `narrative-quality.engine.ts` | Quality score (0–100) |
| `transition-failure.engine.ts` | Common failure breakpoints |
| `institutional-flow.engine.ts` | ACCUMULATION, ABSORPTION, MOMENTUM_CHASING, etc. |
| `narrative-playbook.engine.ts` | Discover narrative playbooks |
| `market-state-synthesis.service.ts` | Orchestrator |

## Market states

```
OPENING_DRIVE → EARLY_EXTENSION → ACCEPTANCE → SECOND_LEG_CONTINUATION → TREND_EXPANSION
              ↘ FAILED_BREAKOUT → PULLBACK_STABILIZATION → VWAP_RECLAIM
              ↘ LIQUIDITY_SWEEP → TRAP_REVERSAL
              ↘ EXHAUSTION → LATE_CHASE_ENVIRONMENT
```

States are inferred from signal features: session time, extension, VWAP distance, sequencing state, fakeout risk, trend alignment.

## Trajectories

| Trajectory | Meaning | Aggression (Phase 148) |
|------------|---------|------------------------|
| NARRATIVE_IMPROVING | States progressing positively | Allowed |
| NARRATIVE_STABLE | Consistent path | Allowed |
| NARRATIVE_FAILING | Weak transitions | Restrict |
| NARRATIVE_EXHAUSTED | Extension exhaustion | Downgrade conviction |

## Live intel outputs

`LiveMarketStateIntel`:

- `currentState` — active market state
- `trajectory` — narrative trajectory enum
- `narrativeQuality` — 0–100 score
- `compactLine` — execution rail primary label
- `narrativeLine` — detail narrative text
- `flowLabel` — institutional flow type

## Downstream consumers

| Consumer | Usage |
|----------|-------|
| Phase 146 Adaptive Entry | `narrativeTrajectory`, `marketState` for entry window |
| Phase 143 Live Decision | `narrativeQuality` gates wait vs full execution |
| Phase 148 Calibration | Narrative stability → aggression allowance |
| Phase 140 Trade Timeline | `marketStatePath[]` per trade |
| Phase 139 Playbook Discovery | Narrative sequences as playbook candidates |

## Narrative playbooks

`NarrativePlaybookEngine` discovers recurring state sequences with:

- Sample count, expectancy, continuation rate, fakeout rate
- Stability score, verdict (BEST / DANGEROUS / NEUTRAL)

Reused by Phase 146 for `PlaybookEntryZone[]`.

## Edge Lab section

"Market Narrative Analytics" in Edge Refinement Lab:

- State transition expectancy matrix
- Narrative playbooks (best / dangerous)
- Transition failure insights
- Synthesis observation lines

## Key analytical findings

See `docs/discoveries/`:

- Opening extensions unstable → quick exhaustion transitions
- Second-leg continuation strongest survival path
- Narrative stability critical before FULL_EXECUTION
- Failed breakout → reclaim hold is high-value transition

## Safety

- `advisoryOnly: true` on all narrative outputs
- Narratives describe context — they do not trigger state changes in live trading logic
- `authoritative` when n ≥ 10
