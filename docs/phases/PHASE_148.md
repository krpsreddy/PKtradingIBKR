# Phase 148 — Adaptive Calibration Engine

## Goal

**Self-awareness + calibration only** — calibrate conviction, wait decisions, suppression, narrative confidence, expansion capture, and governance balance using historical decision accuracy, regret, and missed expansion. No auto-mutation.

## New Engines

**Module:** `frontend/src/app/services/signal-intelligence/adaptive-calibration/`

| Engine | Role |
|--------|------|
| `conviction-calibration-engine.ts` | Expected vs actual R by conviction band |
| `wait-calibration-engine.ts` | Wait strategy aggressiveness |
| `suppression-calibration-engine.ts` | Safe vs unsafe suppression zones |
| `narrative-confidence-engine.ts` | Narrative stability → aggression allowance |
| `expansion-capture-efficiency.engine.ts` | Aggressive vs patient capture % |
| `adaptive-governance-balance.engine.ts` | Safety vs expansion balance |
| `calibration-regret-engine.ts` | Composite regret score |

**Orchestrator:** `adaptive-calibration-synthesis.service.ts`

## Expected R Reference Curve

```
ELITE: 2.5R · HIGH: 2.1R · MODERATE: 0.8R · LOW: 0.3R · AVOID: -0.2R
```

## Integrations

- Live: `adaptiveCalibrationIntel` → Phase 143 context overlays
- Execution Panel — calibration guidance line
- Edge Lab — "Adaptive Calibration Analytics" section
- Playbook Lab — calibration profiles per playbook type
- Trade Timeline — per-trade conviction accuracy, wait efficiency, suppression regret

## Live Decision Overlay Effects

- Overstated conviction → `REDUCE_SIZE`
- Stable narrative + conservative governance → `PROBING_EXECUTION` / `FULL_EXECUTION` when calibrated
- FULL_EXECUTION requires stable narrative + calibrated conviction + low regret zone
- WAIT only when `waitJustified` from historical wait benefit

## Key Discoveries

- HIGH conviction often overstated vs actual outcomes
- MODERATE conviction frequently understated (under-trusted continuation)
- TRAP_RISK suppression safe; CHASE suppression often unsafe
- Waiting helps fakeouts but sacrifices expansion in fast environments

## Safety Constraints

- `advisoryOnly: true`
- `MIN_AUTHORITATIVE = 10`, `MIN_LOW_CONFIDENCE = 25`
- No auto-threshold mutation, no auto-playbook enablement
