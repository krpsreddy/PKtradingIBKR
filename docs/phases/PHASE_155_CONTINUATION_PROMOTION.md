# Phase 155 — Continuation Acceptance & Profitability Promotion Engine

**Status:** Implemented  
**Scope:** Advisory-only — promotes statistically proven continuation structures to chart-visible entries

> Note: Signal-centric replay navigation is documented separately in `PHASE_155.md`.

---

## Goal

Upgrade governance from fear-based suppression to **statistically calibrated continuation participation**. Historically profitable continuation archetypes (e.g. SECOND_LEG + WEAK_ACCEPTANCE) may promote WAIT/AVOID → FULL_EXECUTION on **live chart, replay chart, and execution rail**.

---

## Module

```
frontend/src/app/services/signal-intelligence/continuation-promotion/
├── continuation-promotion.models.ts
├── continuation-promotion.util.ts
├── healthy-continuation-engine.ts
├── continuation-vs-exhaustion.engine.ts
├── pullback-digestion-classifier.engine.ts
├── continuation-governance-rebalance.engine.ts
├── elite-continuation-profile.engine.ts
├── institutional-reclaim-promotion.engine.ts
├── trend-persistence-confidence.engine.ts
└── continuation-promotion-synthesis.service.ts
```

---

## Reclassification

| Classification | Meaning |
|----------------|---------|
| HEALTHY_CONTINUATION | Digestion before expansion — not exhaustion |
| INSTITUTIONAL_RECLAIM | VWAP reclaim hold after pullback |
| SECOND_LEG_ACCEPTANCE | Second-leg compression (high priority) |
| TREND_DIGESTION | Sideways consolidation, structure intact |
| CONTROLLED_PULLBACK | Shallow/stable pullback |
| TRUE_EXHAUSTION | Vertical extension + failing structure |
| FAILED_CONTINUATION | Failing acceptance/pullback |
| LATE_EXTENSION | Extended + late session parabolic |

---

## Promotion Thresholds

Promote when historical stats show:
- WR > 70%
- avgR > +1.5R
- continuation > 60%
- fakeout < 20%
- n >= 50

---

## Chart-Visible Entry Types

| Type | Marker |
|------|--------|
| CONTINUATION_BUY | ▲ CONT BUY |
| VWAP_RECLAIM_BUY | ▲ VWAP RECLAIM |
| SECOND_LEG_BUY | ▲ 2ND LEG |
| DIGESTION_BREAKOUT | ▲ DIGESTION |
| TREND_ACCEPTANCE_BUY | ▲ TREND ACC |
| PULLBACK_HOLD_ENTRY | ▲ PULLBACK HOLD |
| ADD_ON_RECLAIM | ▲ ADD RECLAIM |

---

## Integration Points

| Surface | Integration |
|---------|-------------|
| **Live execution rail** | `ExecutionDecisionSynthesisService.liveDecision()` → `ContinuationPromotionSynthesisService.applyToLiveDecision()` |
| **Replay chart markers** | `ReplayEntryDecisionEngine.buildOverlay()` — promotion upgrades WAIT → green continuation markers |
| **Replay timeline** | Shows "↑ promoted" + original decision |
| **Edge Lab** | Continuation Promotion Analytics section |
| **Execution panel** | Green promotion banner when active |

---

## Safety

- Advisory only — no auto-trading, no threshold mutation
- n < 10 = INSUFFICIENT
- n < 25 = LOW confidence
- TRUE_EXHAUSTION / LATE_EXTENSION never promoted

---

## Success Criteria

1. Replay AMD trends show ▲ 2ND LEG / ▲ VWAP RECLAIM markers where old engine showed WAIT
2. Execution rail shows promotion reason when stats justify participation
3. Healthy digestion no longer auto-labeled exhaustion
4. Second-leg + weak acceptance recognized as elite archetype
