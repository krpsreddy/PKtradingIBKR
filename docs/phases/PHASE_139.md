# Phase 139 — Playbook Discovery (Playbook Lab)

## Goal

Detect **recurring profitable condition sequences** from 60D signal history for **human review only** — slow-evolution playbook discovery with no auto-trading.

## New Engines

**Module:** `frontend/src/app/services/signal-intelligence/playbook-discovery/`

| Engine | Role |
|--------|------|
| `playbook-candidate-discovery.engine.ts` | Find candidate sequences |
| `playbook-evolution.engine.ts` | Track candidate evolution over time |
| `playbook-simulation.engine.ts` | Simulate candidate performance |
| `playbook-relationship.engine.ts` | Overlap/conflict between candidates |
| `playbook-synthesis.engine.ts` | AI-style deterministic summary |

**Store:** `playbook-candidate.store.ts`  
**Orchestrator:** `playbook-discovery.service.ts`  
**UI:** `components/playbook-lab/`

## Qualification Floors

```
MIN_QUALIFY_SAMPLES = 10
MIN_EXPECTANCY_R = 0.35
MAX_FAKEOUT_RATE = 45%
MIN_UNIQUE_SYMBOLS = 3
MIN_UNIQUE_SESSIONS = 3
```

## Promotion States (Manual Only)

`DISCOVERED` → `REVIEWED` → `APPROVED` → `ACTIVE_PLAYBOOK`

## Integrations

- Review Workspace tab: `playbook-lab`
- Phase 147: bulk upsert playbook candidates to PostgreSQL
- Phase 148: calibration profiles shown per playbook type

## Key Discoveries

- Narrative-driven sequences outperform single-setup filters
- Candidates require cross-symbol/session validation to avoid overfitting

## Safety Constraints

- `advisoryOnly: true` on all candidates
- No auto-promotion — human button in Playbook Lab only
- Active playbook still advisory — no auto-signal generation
