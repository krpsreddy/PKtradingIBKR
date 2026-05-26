# Phase 145 — Market State Machine + Execution Narrative Engine

## Goal

Transform isolated signals into **evolving trade narratives** — state transitions, trajectories, institutional flow, and narrative playbooks. Advisory only.

## New Engines

**Module:** `frontend/src/app/services/signal-intelligence/market-state/`

| Engine | Role |
|--------|------|
| `market-state-machine.engine.ts` | Per-signal state path |
| `execution-narrative.engine.ts` | Human-readable narrative + rail line |
| `state-transition-expectancy.engine.ts` | Expectancy by transition path |
| `narrative-quality.engine.ts` | Narrative quality score |
| `transition-failure.engine.ts` | Common failure transitions |
| `institutional-flow.engine.ts` | Flow type classification |
| `narrative-playbook.engine.ts` | Narrative playbook discovery |

**Orchestrator:** `market-state-synthesis.service.ts`

## Market States (sample)

`OPENING_DRIVE` · `LIQUIDITY_SWEEP` · `VWAP_RECLAIM` · `ACCEPTANCE` · `SECOND_LEG_CONTINUATION` · `TRAP_REVERSAL` · `EXHAUSTION` · `LATE_CHASE_ENVIRONMENT`

## Trajectories

`NARRATIVE_IMPROVING` · `NARRATIVE_STABLE` · `NARRATIVE_FAILING` · `NARRATIVE_EXHAUSTED`

## Integrations

- Execution Panel — narrative rail line + flow label (overrides decision meta)
- Phase 146 — narrative trajectory feeds adaptive entry
- Phase 148 — narrative confidence calibration
- Trade Timeline — `marketStatePath` per trade
- Edge Lab — "Market Narrative Analytics" section

## Key Discoveries

- Narrative stability is critical for aggression allowance
- Opening extensions often transition to exhaustion quickly
- Second-leg continuation narratives have strongest survival

## Safety Constraints

- `advisoryOnly: true`
- `authoritative` when n ≥ 10
