# Phase 137 — Live Execution Gate

## Goal

Combine open type, premarket extension, continuation quality, fakeout risk, suppressions, edge-today score, and capital allocation into a **single live gate state** that qualifies whether edge is active for the current symbol/setup.

## New Engines

**Module:** `frontend/src/app/services/signal-intelligence/live-execution/`

| Engine | Role |
|--------|------|
| `live-execution-gate.engine.ts` | Primary gate resolution |
| `open-type-classification.engine.ts` | Opening drive vs fail vs recovery |
| `premarket-extension-analytics.engine.ts` | Extension bucket analysis |
| `continuation-quality.engine.ts` | Continuation strength |
| `live-fakeout-risk.engine.ts` | Live trap/fakeout scoring |
| `execution-suppression.engine.ts` | Active suppression rules |
| `edge-today.engine.ts` | Session edge score |
| `live-capital-allocation.engine.ts` | Rank-weighted allocation hint |
| `execution-playbook.engine.ts` | Daily playbook priority |
| `execution-edge-score.engine.ts` | Composite execution score |

**Orchestrator:** `live-execution-gate.service.ts`

## Gate States

`EDGE_ACTIVE` · `SELECTIVE` · `REDUCE_SIZE` · `NO_EDGE` · `TOXIC`

## Integrations

- `ExecutionAdvisoryAnalyticsService` → `liveGate` in snapshot
- Execution Panel — gate banner, governance sublines, execution score metrics
- Feeds Phase 143 `LiveDecisionContext` (`governanceState`, `executionScore`, `sizeMultiplier`)

## Key Discoveries

- Opening-phase signals require different bar minimums than mid-session
- Fakeout risk and continuation quality are primary gate drivers
- Edge-today score helps prioritize watchlist attention

## Safety Constraints

- `advisoryOnly: true` on all gate snapshots
- Gate states are size/filter hints — never order triggers
- Phase 138 adds statistical floors before hard suppression language
