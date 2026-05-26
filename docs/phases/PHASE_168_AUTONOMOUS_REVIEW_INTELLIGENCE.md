# Phase 168 — Autonomous Review Intelligence Migration

## Summary

Migrated the entire Review + Analytics workspace from legacy signal ontology to **Autonomous Execution Intelligence** terminology, aligned with Phases 166–167 execution layer.

## Review Tab Renames

| Old | New |
|-----|-----|
| Signal Intel | Execution Intelligence |
| Edge Lab | Autonomous Edge Lab |
| Symbol DNA | Autonomous Symbol Profile |
| Session Review | Regime Session Review |
| My Edge | Execution Edge |
| Playbooks | Autonomous Playbooks |
| Playbook Lab | Strategy Research Lab |
| Trade Timeline | Execution Timeline |
| Edge Refinement | Regime Refinement |
| Signal Explorer | Opportunity Explorer |
| Analytics Query | Autonomous Analytics |
| History | Execution History |

## Filter Migration

Removed: OPEN MOM, CONT, OPEN FAIL, Top Rank, No EXT

Added autonomous filters:
- Early Expansion, Persistence, Healthy Pullback, VWAP Acceptance
- Compression Ready, High Velocity, Confirmed, Developing
- Exhaustion Risk, Failed Expansion, Regime Transition

Filters use `autonomousCards` + regime mapping when available.

## Core Module

`utils/autonomous-terminology.util.ts` — central legacy→regime mapping, coaching translation, trend labels, symbol personality defaults.

## Updated Surfaces

- Filter bar + workflow filters (with localStorage migration)
- Execution Intelligence panel labels
- Opportunity Explorer columns (Regime, Action, Velocity)
- Execution History table (Regime column)
- Autonomous Symbol Profile headers
- Autonomous Playbooks (DEFAULT_PLAYBOOKS)
- Adaptive regime ranking (coaching message translation)
- Dashboard command palette + bottom tabs
- Live opportunity cards, smart empty states

## Verification

```bash
cd frontend && npm run build
```

Review workspace should show no OPEN_MOM / CONT / Signal Intel labels in primary navigation.
