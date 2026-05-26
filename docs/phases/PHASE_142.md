# Phase 142 — Entry Acceptance Sequencing

## Goal

Track **entry acceptance states** and transitions — reclaim hold, pullback stability, continuation acceptance, second-leg confirmation, and sequencing regret.

## New Engines

**Module:** `frontend/src/app/services/signal-intelligence/entry-sequencing/`

| Engine | Role |
|--------|------|
| `entry-acceptance-sequencing.engine.ts` | State machine for acceptance |
| `acceptance-transition.engine.ts` | Transition quality |
| `reclaim-acceptance-validation.engine.ts` | Reclaim hold validation |
| `pullback-stability.engine.ts` | Pullback stability levels |
| `continuation-acceptance.engine.ts` | Continuation acceptance levels |
| `second-leg-confirmation.engine.ts` | Second-leg detection |
| `execution-sequencing-simulation.engine.ts` | Wait strategy simulation |
| `sequencing-regret-analysis.engine.ts` | Regret from waiting/acting |

**Orchestrator:** `entry-sequencing-synthesis.service.ts`

## Key States

- `EntryAcceptanceState` — LIQUIDITY_SWEEP, FAILED_ACCEPTANCE, RECLAIM_HOLD, etc.
- `ContinuationAcceptanceLevel` — WEAK / MODERATE / STRONG
- `PullbackStabilityLevel` — UNSTABLE / STABILIZING / STABLE

## Integrations

- Live: `entrySequencingIntel` → Execution Panel + Phases 143/145
- Lab: embedded in Edge Refinement Report
- Shared with Phase 144 decision-feedback via `contextFromSignal()`

## Key Discoveries

- Second-leg confirmation has best continuation survival
- Reclaim-hold wait reduces fakeouts with expansion cost
- LIQUIDITY_SWEEP / FAILED_ACCEPTANCE → TRAP_RISK in live decision

## Safety Constraints

- `advisoryOnly: true`
- `authoritative` when n ≥ 10
