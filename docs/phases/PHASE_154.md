# Phase 154 — Winner Decomposition & Expansion Capture Engine

**Status:** Implemented  
**Scope:** Advisory analytics only — no auto-trading, no threshold mutation

---

## Goal

Analyze historical replay snapshots and evaluated signal intelligence to discover **predictive pre-entry conditions** that precede large expansion winners (GT_2R / GT_3R), identify governance suppression failures, and recommend where FULL_EXECUTION should have occurred.

---

## Module

```
frontend/src/app/services/signal-intelligence/winner-decomposition/
├── winner-decomposition.models.ts
├── winner-decomposition.util.ts
├── expansion-winner-query.service.ts
├── winner-condition-clustering.engine.ts
├── continuation-precondition.engine.ts
├── suppression-failure-analysis.engine.ts
├── elite-expansion-profile.engine.ts
├── entry-recapture.engine.ts
└── winner-decomposition-synthesis.service.ts
```

---

## Architecture

```
SignalIntelligenceStore (evaluated snapshots)
        ↓
ExpansionWinnerQueryService  → GT_2R+ winners
        ↓
Engines (pre-entry extraction at signal timestamp)
  ├── ContinuationPreconditionEngine   → elite conditions + expansion matrix
  ├── SuppressionFailureAnalysisEngine → missed winners + governance failures
  ├── WinnerConditionClusteringEngine  → narrative clusters + trend persistence
  ├── EliteExpansionProfileEngine        → recommended profiles + AMD case studies
  └── EntryRecaptureEngine               → FULL_EXECUTION recapture points
        ↓
WinnerDecompositionSynthesisService → WinnerDecompositionReport
        ↓
Global Edge Lab UI — "Winner Decomposition Analytics"
```

---

## Pre-Entry Extraction

For each large winner, conditions are captured **at signal fire time** (not post-move):

| Dimension | Fields |
|-----------|--------|
| Entry location | reclaim, VWAP reclaim, second leg, opening drive, breakout hold, post-acceptance |
| Market structure | higher lows, compression, trend alignment, reclaim after flush, VWAP acceptance, ORB hold |
| Indicators | RVOL bucket, EMA stack, trend alignment, VWAP distance, session window |
| Narrative | state path, trajectory, stability, continuation acceptance, fakeout risk |
| Governance | live decision, suppression reasons, wouldFullExecution flag |

---

## Report Outputs

`WinnerDecompositionReport` includes:

- `topExpansionNarratives`
- `suppressedWinnerPatterns`
- `eliteEntryConditions`
- `governanceFailures`
- `continuationAcceptanceProfiles`
- `recommendedEntryProfiles`
- `falseAvoidPatterns`
- `trendPersistenceAnalytics`
- `expansionConditionMatrix`
- `biggestWinners` / `missedWinners`
- `amdCaseStudies` (340→355, 396→425)

---

## AMD Case Studies

Built-in price-zone matchers:

| ID | Zone | Target |
|----|------|--------|
| `amd-340-355` | Entry 338–346 | Max ≥ 352 |
| `amd-396-425` | Entry 393–402 | Max ≥ 418 |

Decomposition identifies earliest institutional entry, ideal reclaim, second-leg trigger, governance suppression cause, and recommended FULL_EXECUTION point.

---

## Safety

- `advisoryOnly: true` on all reports
- `n < 10` → INSUFFICIENT confidence (not authoritative)
- `n < 25` → LOW confidence
- No auto-trading, auto-threshold mutation, or autonomous playbook activation

---

## UI

**Global Edge Lab** → section **Winner Decomposition Analytics**

Panels:
1. Biggest Winners
2. Missed Winners (governance suppression)
3. Elite Entry Profiles
4. Expansion Condition Matrix
5. AMD Case Studies

---

## Success Criteria

Answers:
1. Why did AMD trend +7% after WAIT/AVOID?
2. Where SHOULD the system have entered?
3. Which conditions repeatedly precede elite expansions?
4. Which governance penalties suppress real winners?
5. What differentiates elite continuation from exhaustion?

---

## Related Phases

- Phase 148 — Adaptive calibration / expansion capture
- Phase 141 — Edge refinement / missed winners
- Phase 156 — Analytics query workbench (PostgreSQL diagnostics)
