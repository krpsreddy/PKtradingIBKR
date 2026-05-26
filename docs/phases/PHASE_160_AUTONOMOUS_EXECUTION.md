# Phase 160 — Autonomous Execution Framework Migration

**Status:** Implemented · Advisory only

Migrates primary execution from handcrafted governance to data-mined structural participation.

## Execution Modes

| Mode | Behavior |
|------|----------|
| AUTONOMOUS_DISCOVERY | Primary — structure score, VWAP, RVOL, pullback depth (default) |
| LEGACY_GOVERNANCE | Phase 155/143 handcrafted path only |
| HYBRID_COMPARISON | Both paths — legacy snapshot on `legacyDecision` |

## Module

`frontend/src/app/services/signal-intelligence/autonomous-execution/`

Legacy signals preserved in `legacy-governance/legacy-governance.index.ts` — not deleted.

## Integration

- `ExecutionModeService` — persisted mode selector
- `AutonomousExecutionSynthesisService` — live + replay + analytics
- Replay markers — purple (STRUCT ACCEL, AUTO_ENTRY, CONT ADD)
- Global Edge Lab — Autonomous Execution Analytics + mode bar

## Safety

Exhaustion/parabolic guard retained. No auto-trading or threshold mutation.
