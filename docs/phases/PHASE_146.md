# Phase 146 — Adaptive Entry Optimization Engine

## Goal

Optimize **execution timing and location** inside narratives using historical transition outcomes. Advisory only.

## New Engines

**Module:** `frontend/src/app/services/signal-intelligence/adaptive-entry/`

| Engine | Role |
|--------|------|
| `adaptive-entry-window.engine.ts` | Best entry windows inside narratives |
| `aggressive-vs-patient-entry.engine.ts` | Aggressive vs patient style matrix |
| `entry-location-quality.engine.ts` | Location classification (IDEAL, TRAP, etc.) |
| `narrative-entry-efficiency.engine.ts` | % of narrative move captured |
| `missed-expansion-analysis.engine.ts` | Cost of waiting on expansion |
| `institutional-timing-patterns.engine.ts` | Session timing patterns |

**Orchestrator:** `entry-optimization-synthesis.service.ts`

## Integrations

- Execution Panel — `adaptiveEntryLine()` guidance
- Phase 143 — `entryLocationQuality` in decision context; poor location → TRAP_RISK / AVOID_CHASE
- Edge Lab — "Adaptive Entry Analytics" section
- Trade Timeline — `entryLocation`, `entryEfficiencyPct`
- Reuses `NarrativePlaybookEngine` for `PlaybookEntryZone[]`

## Key Discoveries

- Patient pullback wait captures ~40% of move but reduces fakeouts
- Second-leg acceptance captures ~70%+ with better continuation survival
- TRAP_LOCATION entries should never receive FULL_EXECUTION

## Safety Constraints

- `advisoryOnly: true`
- Location/style guidance only — no auto entry timing
