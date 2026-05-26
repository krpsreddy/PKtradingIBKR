# Phase 141 — Execution Quality + Edge Refinement

## Goal

Two parallel tracks sharing phase number:

1. **Execution quality** — classify entries (EARLY/IDEAL/LATE/CHASE), chase subtypes, reclaim quality
2. **Edge refinement** — simulate suppression rules, validate dangerous conditions, acceptance confirmation, entry timing

## New Engines

### execution-quality/

| Engine | Role |
|--------|------|
| `execution-entry-classification.engine.ts` | Entry timing classification |
| `execution-quality-expectancy.engine.ts` | Expectancy by entry class |
| `good-vs-bad-chase.engine.ts` | Chase quality subtypes |
| `reclaim-quality.engine.ts` | Reclaim hold quality |
| `missed-winner-analysis.engine.ts` | Winners filtered by rules |

**Orchestrator:** `execution-quality-synthesis.service.ts`

### edge-refinement/

| Engine | Role |
|--------|------|
| `suppression-validation.engine.ts` | Rule simulation |
| `dangerous-entry-analysis.engine.ts` | Dangerous condition detection |
| `acceptance-confirmation.engine.ts` | Wait-for-confirmation value |
| `entry-timing-simulation.engine.ts` | Entry timing presets |
| `missed-winner-analysis.engine.ts` | Over-suppression detection |

**Orchestrator:** `edge-refinement-report.service.ts` (aggregates phases 141–148)  
**UI:** `components/edge-refinement-lab/`

## Integrations

- Live: `executionQualityIntel` → Execution Panel + Phase 143
- Lab: primary aggregation hub for all refinement reports
- Preset simulations via `runPreset()` / `SIMULATION_PRESETS`

## Key Discoveries

- Good chase vs bad chase have opposite expectancy profiles
- Reclaim quality is a strong predictor of continuation survival
- Many suppression rules are validated; some over-suppress winners

## Safety Constraints

- `advisoryOnly: true`
- `MIN_AUTHORITATIVE_SAMPLE = 10`, `MIN_LOW_CONFIDENCE_SAMPLE = 25`
- Simulations recommend — never auto-apply suppression rules
