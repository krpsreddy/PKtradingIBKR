# Phase 140 — Trade Lifecycle Intelligence (Trade Timeline)

## Goal

Explain **why trades succeed or fail** through lifecycle paths, outcome attribution, management analytics, and coaching — analytics and coaching only.

## New Engines

**Module:** `frontend/src/app/services/signal-intelligence/trade-lifecycle/`

| Engine | Role |
|--------|------|
| `trade-lifecycle.engine.ts` | Build lifecycle event paths |
| `outcome-attribution.engine.ts` | Signal vs execution vs management attribution |
| `trade-management-analytics.engine.ts` | Management quality metrics |
| `exit-quality.engine.ts` | Exit efficiency per trade |
| `management-style-expectancy.engine.ts` | Style × expectancy matrix |
| `playbook-lifecycle.engine.ts` | Playbook-specific lifecycle insights |
| `trade-lifecycle-coaching.engine.ts` | Coaching headline generation |

**Orchestrator:** `trade-lifecycle.service.ts`  
**UI:** `components/trade-lifecycle-lab/` (Trade Timeline), `execution-coaching-panel/`

## Integrations

- Review Workspace tab: `trade-timeline`
- Execution Panel: `lifecycleCoach` when no live decision banner
- Phases 145/146: `marketStatePath`, `entryLocation`, `entryEfficiencyPct` on snapshots
- Phase 148: per-trade calibration metrics (conviction accuracy, wait efficiency, suppression regret)

## Key Discoveries

- Many failures are execution/management failures despite correct signal direction
- Entry timing (IDEAL vs LATE vs CHASE) strongly predicts attribution type

## Safety Constraints

- `advisoryOnly: true` on all lifecycle/coaching snapshots
- Coaching is informational — no automated trade management
