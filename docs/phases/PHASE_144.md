# Phase 144 — Decision Feedback Loop

## Goal

**Self-audit execution decisions** against 60D outcomes — wait-vs-act analysis, regret, conviction calibration, consistency, and adaptive observations. Advisory only, no auto-mutation.

## New Engines

**Module:** `frontend/src/app/services/signal-intelligence/decision-feedback/`

| Engine | Role |
|--------|------|
| `decision-feedback.engine.ts` | Re-run live decision on history; build audit rows |
| `wait-vs-act.engine.ts` | Instant vs wait strategy comparison |
| `decision-regret.engine.ts` | False avoids, excessive waiting |
| `conviction-calibration.engine.ts` | Conviction band vs outcome alignment |
| `decision-consistency.engine.ts` | Context instability detection |
| `adaptive-decision-observation.engine.ts` | Deterministic observation synthesis |
| `decision-reliability-score.engine.ts` | Engine reliability scoring |

**Orchestrator:** `decision-feedback-synthesis.service.ts`

## Integrations

- Live: `decisionFeedbackIntel.adaptiveInsightLine` on Execution Panel
- Lab: "Decision Feedback Analytics" section in Edge Refinement Lab
- Audit rows include `marketStatePath` from Phase 145

## Key Discoveries

- WAIT decisions can outperform instant entry in fakeout-heavy environments
- TRAP_RISK correctly avoids many failed continuations
- Governance may be over-conservative — high regret scores warrant review

## Safety Constraints

- `advisoryOnly: true`
- `MIN_AUTHORITATIVE = 10`, `MIN_LOW_CONFIDENCE = 25`
- Observations never mutate thresholds or rules
