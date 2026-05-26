# Phase 156 — Opening Drive Expansion & Early Participation Engine

**Status:** Implemented  
**Scope:** Advisory-only — detects institutional opening expansion days and enables early participation before full extension

> Note: Analytics Query Workbench is documented separately in `PHASE_156.md`.

---

## Goal

Participate **early** in elite institutional trend days that begin immediately after market open and rarely provide deep pullbacks. Stop defaulting to WAIT/AVOID/EXTENDED when historical statistics show the move rarely pulls back.

---

## Module

```
frontend/src/app/services/signal-intelligence/opening-expansion/
├── opening-expansion.models.ts
├── opening-expansion.util.ts
├── opening-drive-imbalance.engine.ts
├── early-expansion-qualification.engine.ts
├── institutional-opening-drive.engine.ts
├── trend-day-persistence.engine.ts
├── opening-volume-acceleration.engine.ts
├── first-pullback-opportunity.engine.ts
└── expansion-participation-synthesis.service.ts
```

---

## Classification

| Classification | Meaning |
|----------------|---------|
| INSTITUTIONAL_EXPANSION | Sustained RVOL, ORB acceptance, shallow pullbacks |
| RETAIL_EXHAUSTION | Vertical blowoff, rejection, volume collapse — avoid |
| CONTROLLED_DIGESTION | First controlled pullback on trend day |
| NEUTRAL_OPENING | Insufficient evidence |

---

## Participation Modes

| Mode | When |
|------|------|
| PROBING_OPEN | Early probe when qualification score ≥ 45 |
| OPENING_DRIVE_FULL | Institutional imbalance + score ≥ 70 |
| FIRST_PULLBACK_ADD | First controlled digestion 8–45m |

---

## Chart-Visible Entry Types

| Type | Marker |
|------|--------|
| OPENING_DRIVE_BUY | OPEN DRIVE |
| EARLY_EXPANSION_BUY | EARLY EXP |
| INSTITUTIONAL_IMBALANCE_BUY | IMBALANCE BUY |
| TREND_DAY_INITIATION | TREND DAY |
| FIRST_PULLBACK_BUY | FIRST PB ADD |
| OPENING_ACCEPTANCE_BUY | OPEN ACC |

Markers use amber (`#f59e0b`) to distinguish from Phase 155 green continuation markers.

---

## Promotion Thresholds

When historical analytics show:
- WR > 70%
- avgR > +2R
- continuation > 70%
- fakeout < 20%
- n >= 50

Governance reduces suppression penalties for early continuation participation.

---

## Integration Points

| Surface | Integration |
|---------|-------------|
| **Live execution rail** | `ExecutionDecisionSynthesisService.liveDecision()` → opening expansion (≤30m) then continuation promotion |
| **Replay chart markers** | `ReplayEntryDecisionEngine.buildDirectOpeningExpansionOverlay()` — priority over continuation |
| **Global Edge Lab** | Opening Expansion Analytics panel + QCOM 212→240 case study |
| **Lazy enrichment** | `ExpansionParticipationSynthesisService.refresh()` after hydration |

---

## QCOM Case Study

Built-in decomposition for QCOM 212→240:
- Earliest participation: 9:35 OPEN_MOM_BUY
- First 5m: gap continuation + ORB acceptance + RVOL stack
- First PB add: 10:05–10:15 shallow digestion
- Suppression cause: WAIT_FOR_PULLBACK bias before +3R proved

---

## Advisory Only

No auto-trading, no threshold mutation. All promotions are chart-visible guidance for discretionary execution.
