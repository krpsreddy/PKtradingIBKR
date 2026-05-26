# Autonomous Execution Terminology

> **Canonical trader terminology reference** for the PKtradingIBKR execution platform.  
> Classification: **Architecture · Execution Language · Onboarding**  
> Last consolidated: documentation pass (post Phase 180 exit validation research)

---

## Purpose

This document is the **single source of truth** for:

- Trader-facing UI strings during live trading
- Internal regime and action identifiers
- Mapping between legacy signal names and autonomous language
- Which code modules own which label families
- Terminology governance for future development

**Audience:** traders, Cursor agents, and engineers working on scanner, execution, replay, sidebar, regime, or execution-plan systems.

**Not in scope:** changing runtime labels or execution logic (documentation only).

---

## How labels reach the screen

Trader-facing text is produced by **multiple mappers** — there is no one global dictionary.

| Surface | Primary source | Display transform |
|--------|----------------|-------------------|
| Dominant hero state | `DominantOpportunityState` | `formatLabel()` → `_` → space |
| Dominant hero regime | `regimeGroupForType()` | Strips `"High Conviction "` prefix |
| Scanner badges | `badgeForType()` | Emoji + fixed text |
| Scanner live state (sidebar) | `STATE_LABELS` | Title case via `scannerLiveStateLabel()` |
| Execution plans / cluster family | `CANONICAL_REGIME_LABELS` | `formatCanonicalRegimeLabel()` |
| Legacy signal → regime (review) | `REGIME_LABELS` | `formatAutonomousRegime()` |
| Card primary action | `deriveDominantAction()` | `primaryLabel` / `secondaryLabel` |
| Live execution rail | `LiveDecisionEngine.decisionDisplay()` | Spaces from `_` |
| Trigger overlay | `TraderExecutionAction` | `actionLabel()` → `replace(/_/g, ' ')` |
| Exit on plan | `TemplateExitEngine` + `AdaptiveExitState` | Fixed strings or spaced enums |
| Replay markers | `entryTypeLabel`, `triggerMarker`, `regimeMarker` | Per-util switches |

---

## Source of truth (file ownership)

Paths are relative to `frontend/src/app/`.

### Regime naming

| Concern | Owner file(s) | Types / exports |
|---------|---------------|-----------------|
| **Canonical execution regimes** (plans, templates, cluster families) | `services/cluster-family-intelligence/cluster-family.models.ts` | `CanonicalExecutionRegime`, `CANONICAL_REGIME_LABELS`, `formatCanonicalRegimeLabel()` |
| **Template display names & coaching** | `services/autonomous-execution-templates/template-registry.service.ts` | `displayName`, `entryStyle`, `stopStyle`, `targetStyle` |
| **Phase 168 regime ontology** (legacy signal translation) | `utils/autonomous-terminology.util.ts` | `AutonomousRegimeType`, `REGIME_LABELS`, `LEGACY_TO_REGIME`, `formatAutonomousRegime()` |
| **Scanner opportunity taxonomy** | `services/autonomous-regime-scanner/autonomous-regime-scanner.models.ts` | `AutonomousOpportunityType` |
| **Opportunity display labels** | `utils/autonomous-terminology.util.ts` | `OPPORTUNITY_TYPE_LABELS`, `formatAutonomousOpportunityType()` |
| **Scanner section / hero regime groups** | `services/autonomous-regime-scanner/scanner-ranking.engine.ts` | `regimeGroupForType()`, `badgeForType()`, `sectionForType()` |
| **Scanner live state** (sidebar row) | `services/autonomous-regime-scanner/scanner-state.engine.ts` | `ScannerLiveState`, `STATE_LABELS`, `resolveScannerLiveState()` |
| **Live regime overlay** (replay / panel) | `services/live-regime-intelligence/live-regime.util.ts` | `regimeMarker()`, `LiveRegimeType`, `LiveRegimeClassification` |
| **Cluster family trader lines** | `services/cluster-family-intelligence/cluster-family-overlay.engine.ts` | `traderCompactLine`, `traderPromotionReason` |

### Execution / entry labels

| Concern | Owner file(s) |
|---------|---------------|
| **Dominant primary/secondary action** | `services/action-dominance/action-dominance.engine.ts` → `deriveDominantAction()` |
| **Live execution decision banner** | `services/signal-intelligence/live-decision/live-decision-engine.ts` → `decisionDisplay()` |
| **Risk / timing copy** | `services/signal-intelligence/live-decision/live-decision.util.ts` → `riskLabel()`, `timingLabel()` |
| **Execution trigger trader actions** | `services/execution-trigger-intelligence/execution-trigger.models.ts`, `execution-trigger-synthesis.service.ts`, `execution-trigger.util.ts` |
| **Continuation promotion markers** | `services/signal-intelligence/continuation-promotion/continuation-promotion.util.ts` |
| **Autonomous execution markers** | `services/signal-intelligence/autonomous-execution/autonomous-execution.util.ts` |
| **Replay overlay full labels** | `services/replay-decision-visualization/replay-entry-decision.engine.ts` |
| **Execution quality compact lines** | `services/signal-intelligence/execution-quality/execution-quality-synthesis.service.ts` |
| **Next-action verb line** | `services/next-action.service.ts` |

### Dominance / attention labels

| Concern | Owner file(s) |
|---------|---------------|
| **Dominant opportunity state** | `services/dominant-opportunity/dominant-opportunity.models.ts`, `dominant-opportunity.service.ts` → `assignState()`, `buildBadges()` |
| **Persistence tier** | `services/dominant-opportunity/continuation-dominance.engine.ts` → `persistenceTier()` |
| **Institutional tier** | `services/dominant-opportunity/institutional-pressure.engine.ts` → `institutionalLabel()` |
| **Hero UI formatting** | `components/dominant-opportunity-hero/dominant-opportunity-hero.component.ts` → `formatLabel()` |

### Exit labels

| Concern | Owner file(s) |
|---------|---------------|
| **Autonomous template exits** | `services/autonomous-execution-templates/template-exit.engine.ts` |
| **Legacy plan exits** | `services/execution-plan/execution-plan-builder.engine.ts` → `formatExitState()` |
| **Adaptive exit states** | `models/probabilistic.model.ts` → `AdaptiveExitState` |
| **Invalidation rule text** | `services/autonomous-execution-templates/template-invalidation.engine.ts` |

### Lifecycle labels

| Concern | Owner file(s) |
|---------|---------------|
| **Plan lifecycle state** | `services/execution-plan/execution-plan.models.ts` → `ExecutionPlanLifecycleState` |
| **Feed maturity** | `services/real-time-execution/real-time-execution.models.ts` → `ExecutionMaturityState` |
| **Lifecycle bar stages** | `services/execution-lifecycle/execution-lifecycle.engine.ts` → `stageLabel()` |
| **Family lifecycle bias** | `services/cluster-family-intelligence/cluster-family-mapper.engine.ts` → `lifecycleBias()` |

---

## Terminology governance

Rules for all future changes to trader-facing language:

1. **No new trader-facing labels without canonical registration** — add the internal ID and UI string to the appropriate table in this document and to the owning util/registry in code.
2. **All regime names must map through terminology utilities** — use `formatCanonicalRegimeLabel()`, `formatAutonomousRegime()`, or `formatAutonomousOpportunityType()`; do not invent ad hoc `replace(/_/g, ' ')` in components except for enums explicitly documented here (e.g. `DominantOpportunityState` via hero `formatLabel()`).
3. **Avoid duplicate synonyms** — one canonical UI string per internal ID per surface; document intentional mismatches in [Naming mismatches](#naming-mismatches-live-trading).
4. **Avoid legacy OPEN_MOM / CONT / MOM_BUY naming in new UI** — map through `autonomous-terminology.util.ts` or opportunity types; legacy strings may remain in backend signals until migrated.
5. **Use canonical regime naming consistently across:**
   - autonomous regime scanner
   - replay decision overlays
   - sidebar / dominant hero
   - execution plans (`CanonicalExecutionRegime`)
   - dominant opportunity engine
   - review workspace / Global Edge Lab formatters
6. **Advisory-only** — new labels are guidance only; never imply auto-execution.
7. **Phase docs** — when a phase introduces new label families, update this file in the same PR as the code (documentation-only PRs are acceptable if code already shipped).

---

## Migration status (label families by subsystem)

| Subsystem | Primary label family | Notes |
|-----------|---------------------|--------|
| **Autonomous regime scanner** | Autonomous | `AutonomousOpportunityType`, badges, `ScannerLiveState` |
| **Dominant opportunity engine** | Autonomous | `DominantOpportunityState`, `regimeGroupForType()` labels |
| **Real-time execution feed** | Autonomous + maturity | Enriched via `deriveDominantAction()`; `ExecutionMaturityState` |
| **Execution plans (mode)** | **Hybrid** | `LEGACY_RR` \| `AUTONOMOUS_TEMPLATE` \| compare; regime from `CanonicalExecutionRegime` |
| **Plan guidance / coaching** | Autonomous when `AUTONOMOUS_TEMPLATE` | Template registry strings; legacy builder uses `HOLD` + spaced adaptive exit |
| **Exits (live)** | **Hybrid** | `TemplateExitEngine` (autonomous) vs `ExecutionPlanBuilderEngine` (legacy); shared `AdaptiveExitState` |
| **Exit validation (research)** | Hybrid comparison | Phase 180 compares LEGACY / AUTONOMOUS / HYBRID paths — no production switch |
| **Replay overlays** | **Hybrid stack** | Priority: opening expansion → execution trigger → autonomous → participation → live regime → legacy promotion |
| **Live decision banner** | Institutional decision set | `LiveExecutionDecision` — orthogonal to regime labels but drives banner text |
| **Backend signals** | **Legacy** | `MOM_BUY`, `CONT_BUY`, `OPEN_FAIL`, etc. — translated at frontend boundary |
| **Telegram / alerts** | Legacy | Backend signal names unless frontend relay added |
| **Explainable regimes / discovery lab** | Canonical + cluster names | `formatCanonicalRegimeLabel()` + discovered cluster names |

**Target state:** one canonical regime axis (`CanonicalExecutionRegime` + opportunity types) with legacy mapping only at ingestion and replay classification boundaries.

---

## 1. Canonical execution regimes

**Internal type:** `CanonicalExecutionRegime`  
**UI mapper:** `CANONICAL_REGIME_LABELS` / `formatCanonicalRegimeLabel()`  
**Templates:** `template-registry.service.ts`

| Internal ID | UI text | Template meaning (code) | Trader bias (code) |
|-------------|---------|-------------------------|-------------------|
| `EARLY_EXPANSION` | Early Expansion | Aggressive momentum entry; wider vol stop | ENTER; exit: `TRAILING CONTINUATION HOLD` |
| `INSTITUTIONAL_PERSISTENCE` | Institutional Persistence | Shallow pullback / hold band | ENTER/ADD; persistence override eligible |
| `VWAP_ACCEPTANCE` | VWAP Acceptance | Reclaim at VWAP; VWAP loss invalidation | ENTER |
| `SHALLOW_PULLBACK_CONTINUATION` | Healthy Pullback Continuation | Pullback zone entry | ENTER/ADD on PB |
| `COMPRESSION_BREAKOUT` | Compression Breakout | Breakout above compression | ENTER |
| `HEALTHY_EXTENSION` | Healthy Extension | Reduced-size continuation; tighter invalidation | ENTER (reduced size) |
| `EXHAUSTION_DRIFT` | Exhaustion Drift | No new entry; trim/exit priority | `allowsEntry: false`; `EXIT PRIORITY` |
| `PERSISTENT_CONTINUATION` | Persistent Continuation | Confirmed trend participation | ENTER; `TRAILING CONTINUATION HOLD` |

**Family overlay strings:** `{displayLabel} · score boost +N`, `{displayLabel} · family confidence N%`.

**Lifecycle bias (internal):** `ENTER` | `ADD` | `WATCH` | `AVOID` | `EXIT`.

---

## 2. Autonomous opportunity types (scanner / feed / cards)

**Internal type:** `AutonomousOpportunityType`  
**Mappers:** `scanner-ranking.engine.ts`, `autonomous-terminology.util.ts`

| Internal ID | UI label | Scanner badge (exact) | Section / hero regime | Default `action` |
|-------------|----------|----------------------|----------------------|------------------|
| `EARLY_CONTINUATION` | Early Continuation | 🟢 HIGH CONTINUATION | Continuations | `ENTER` |
| `INSTITUTIONAL_ACCELERATION` | Institutional Acceleration | 🟢 INSTITUTIONAL PERSISTENCE | Institutional Persistence | `ENTER` |
| `SHALLOW_PULLBACK_CONTINUATION` | Healthy Pullback Continuation | 🟡 HEALTHY PULLBACK | Healthy Shallow Pullbacks | `ENTER` |
| `VWAP_PERSISTENCE` | VWAP Persistence | 🟢 VWAP PERSISTENCE | VWAP Acceptance | `ENTER` |
| `COMPRESSION_RELEASE` | Compression Release | 🟢 COMPRESSION BREAKOUT | Compression Breakouts | `ENTER` |
| `TREND_RESUMPTION` | Trend Resumption | 🟠 LATE EXTENSION | Trend Resumption | `ENTER` |
| `LATE_STAGE_EXHAUSTION` | Late-Stage Exhaustion | 🔴 EXHAUSTION DEVELOPING | Exhaustion / Do Not Chase | `AVOID` |

**Sidebar action chip:** `ENTER` | `WATCH` | `ADD` | `AVOID` | `EXIT` (verbatim via `actionChipLabel()`).

**Card badge strip (when not using dominant action):** emoji prefix removed in `AutonomousExecutionCardComponent.actionLabel()` — shows text after first token of `badge`.

---

## 3. Scanner live state (sidebar)

**Internal type:** `ScannerLiveState`  
**Mapper:** `scanner-state.engine.ts` → `STATE_LABELS`

| Internal ID | UI text | Set when (code) |
|-------------|---------|-----------------|
| `EARLY_EXPANSION` | Early Expansion | `EARLY_CONTINUATION` + `isRising` |
| `PERSISTENT_CONTINUATION` | Persistent Continuation | default / `INSTITUTIONAL_ACCELERATION` |
| `HEALTHY_PULLBACK` | Healthy Pullback | `SHALLOW_PULLBACK_CONTINUATION` |
| `VWAP_ACCEPTANCE` | VWAP Acceptance | `VWAP_PERSISTENCE` |
| `COMPRESSION_READY` | Compression Ready | `COMPRESSION_RELEASE` |
| `LATE_EXTENSION` | Late Extension | `TREND_RESUMPTION` |
| `EXHAUSTION_DRIFT` | Exhaustion Drift | exhaustion type or high exhaustion % |
| `REGIME_BREAKDOWN` | Regime Breakdown | `AVOID` or exhaustion ≥ 75 |

Displayed in sidebar: `resolveScannerLiveState(card)` with spaces (not always `scannerLiveStateLabel()` — verify call site).

---

## 4. Dominant opportunity states (hero)

**Internal type:** `DominantOpportunityState`  
**Logic:** `dominant-opportunity.service.ts` → `assignState()`  
**UI:** `dominant-opportunity-hero` → `formatLabel(state)`

| Internal ID | UI text | Assigned when (code) |
|-------------|---------|----------------------|
| `DOMINANT_NOW` | DOMINANT NOW | Top rank after recompute; badge `DOMINANT` |
| `EMERGING_FAST` | EMERGING FAST | `isEmergingFast()`; sidebar row **EMERGING FASTEST** |
| `INSTITUTIONAL_FLOW` | INSTITUTIONAL FLOW | inst score ≥ 68 + `INSTITUTIONAL_ACCELERATION` |
| `SECOND_LEG_DOMINANCE` | SECOND LEG DOMINANCE | `TREND_RESUMPTION` + expansion ≥ 60 |
| `PERSISTENCE_LEADER` | PERSISTENCE LEADER | continuation score ≥ 72 |
| `WATCHLIST_READY` | WATCHLIST READY | default / `WATCH` |
| `DEGRADING` | DEGRADING | degrading detect or delta ≤ −10 |
| `EXHAUSTING` | EXHAUSTING | exhaustion ≥ 58 or `AVOID` |

**Metrics (verbatim):** persistence `ELITE` | `STRONG` | `MODERATE` | `WEAK`; institutional `HIGH` | `MEDIUM` | `LOW`.

---

## 5. Phase 168 autonomous regime ontology

**Mapper:** `autonomous-terminology.util.ts` — used for review labels, message translation, legacy signal display.

| Internal ID | UI text | Legacy signals mapped |
|-------------|---------|------------------------|
| `EARLY_EXPANSION` | Early Expansion | OPEN_MOM*, OPEN_SCOUT, OPEN_READY, IMBALANCE_UP |
| `PERSISTENT_CONTINUATION` | Persistent Continuation | MOM_BUY, CONT_* |
| `FAILED_EXPANSION` | Failed Expansion | OPEN_FAIL*, RECOVERY_FAIL, IMBALANCE_DOWN |
| `VWAP_ACCEPTANCE` | VWAP Acceptance | VWAP_RECLAIM |
| `SHALLOW_PULLBACK_CONTINUATION` | Healthy Pullback Continuation | PULL_BUY |
| `COMPRESSION_BREAKOUT` | Compression Breakout | narrative keyword |
| `ACCELERATION_INTEGRITY` | Acceleration Integrity | narrative keyword |
| `LATE_EXTENSION` | Late Extension | narrative keyword |
| `EXHAUSTION_DRIFT` | Exhaustion Drift | EXIT |
| `REGIME_TRANSITION` | Regime Transition | narrative keyword |

`translateAutonomousMessage()` applies additional string replacements (e.g. OPEN_MOM → Early Expansion).

---

## 6. Live execution decisions

**Internal type:** `LiveExecutionDecision`  
**UI:** `live-decision-engine.ts` → `decisionDisplay()`

| Internal ID | UI text |
|-------------|---------|
| `FULL_EXECUTION` | FULL EXECUTION |
| `PROBING_EXECUTION` | PROBING EXECUTION |
| `WAIT_FOR_ACCEPTANCE` | WAIT FOR ACCEPTANCE |
| `WAIT_FOR_PULLBACK` | WAIT FOR PULLBACK |
| `REDUCE_SIZE` | REDUCE SIZE |
| `AVOID_CHASE` | AVOID CHASE |
| `AVOID_TRADE` | AVOID TRADE |
| `TRAP_RISK` | TRAP RISK |

**Conviction label:** `{band} CONVICTION {score}%` (e.g. `HIGH CONVICTION 78%`).

**Risk labels (`riskLabel()`):** `Weak breadth risk`, `High fakeout risk`, `Moderate fakeout risk`, `Extension risk elevated`, `Low fakeout risk`.

**Timing labels (`timingLabel()`):** e.g. `Enter now — acceptance confirmed`, `Wait for pullback stabilization`, `Too late — extension elevated`.

---

## 7. Execution trigger overlay

**Types:** `ExecutionTriggerEntryType`, `TraderExecutionAction`, `ChartTriggerZone`

| Entry type (internal) | Marker (chart) | Trader action (UI) |
|----------------------|----------------|---------------------|
| `DIRECT_CONTINUATION_ENTRY` | CONT ENTRY | EARLY CONTINUATION ENTRY |
| `SHALLOW_PULLBACK_ENTRY` | SHALLOW PB | HEALTHY SHALLOW PULLBACK |
| `VWAP_PERSISTENCE_ENTRY` | VWAP HOLD | VWAP HOLD CONTINUATION |
| `MICRO_COMPRESSION_BREAKOUT` | COMPRESS | ADD ON COMPRESSION BREAKOUT |
| `ORB_CONTINUATION_ADD` | ORB ADD | ADD ON COMPRESSION BREAKOUT |
| `ACCELERATION_RECLAIM` | RECLAIM | EARLY CONTINUATION ENTRY |
| `TREND_RESUMPTION_ENTRY` | RESUME | TREND RESUMPTION READY |
| (exhaustion) | — | DO NOT CHASE / LATE STAGE EXHAUSTION |

**Chart zones:** `CONTINUATION_ENTRY`, `SHALLOW_PULLBACK_HOLD`, `COMPRESSION_BREAKOUT`, `VWAP_PERSISTENCE`, `EXTENSION_WARNING`, `EXHAUSTION_DEVELOPING`.

**Integrity quality:** `STRONG` | `SOLID` | `MODERATE` | `WEAK`.

---

## 8. Template exit labels (`AUTONOMOUS_TEMPLATE`)

**Owner:** `template-exit.engine.ts`

| Condition (code) | Exact `exitLabel` |
|------------------|-------------------|
| `EXHAUSTION_DRIFT` | `EXIT PRIORITY` (or spaced adaptive exit state) |
| `EXHAUSTING` + exhaustion ≥ 58, no persistence override | `REDUCE ON EXHAUSTION` |
| `EXTENDED` + persistence override | `TRAIL CONTINUATION · HOLD PERSISTENCE` |
| `EXTENDED`, no override | `TRAIL CONTINUATION · REDUCE ON STALL` |
| Persistence regimes | `TRAILING CONTINUATION HOLD` |
| `DEVELOPING` / `CONFIRMING` | `HOLD — AWAIT CONFIRMATION` |
| Default | `HOLD` |

**Adaptive exit states (`AdaptiveExitState`):** `HOLD`, `SCALE_PARTIAL`, `TAKE_PROFIT`, `EXIT_SOON`, `EXIT_NOW` → displayed with spaces on plan.

**Next-action verbs (`next-action.service.ts`):** `EXIT NOW`, `PARTIALS`, `ENTER LIGHT`, `WAIT`, `ADD {price}`, `HOLD`.

---

## 9. Dominant action labels (cards / feed)

**Owner:** `action-dominance.engine.ts` — exact `primaryLabel` strings:

| Primary | Secondary |
|---------|-----------|
| ENTER NOW | ADD ON PB / WAIT FOR ACCEPTANCE |
| ADD ON PB | REDUCE EXTENSION / HOLD TRAIL |
| REDUCE EXTENSION | HOLD TRAIL |
| WAIT FOR ACCEPTANCE | HOLD STRUCTURE |
| HOLD STRUCTURE | WAIT FOR ACCEPTANCE |
| EXIT WEAKENING | REDUCE EXTENSION |
| AVOID CHOP | EXIT WEAKENING |

---

## 10. Execution quality compact lines

**Owner:** `execution-quality-synthesis.service.ts` — examples of exact emitted strings:

- `IDEAL · LOW FAKEOUT · FULL EDGE`
- `RECLAIM CONFIRMED · …`
- `ACCEPTABLE CONTINUATION · WAIT FOR HOLD · …`
- `EARLY PROBE · WAIT FOR CONFIRMATION · …`
- `GOOD CHASE · STRONG CONT · …` / `CHASE RISK · REDUCE SIZE · …`
- `EXTENDED ENTRY · REDUCE SIZE · …`
- `EXHAUSTION RISK · THIRD LEG EXTENDED · …`
- `TRAP RISK · WEAK BREADTH · …`
- `SWEEP RISK · STOP-HUNT PROFILE · …`

---

## 11. Lifecycle bar stages

**Owner:** `execution-lifecycle.engine.ts` — `stageLabel(id)` = spaced stage id:

`DEVELOPING` → `EARLY EXPANSION` → `PERSISTENCE` → `SHALLOW PB` → `CONFIRMED` → `ADD` → `EXTENDED` → `EXHAUSTING` → `FAILED`

**Plan / feed maturity:** `DEVELOPING` | `CONFIRMING` | `CONFIRMED` | `EXTENDED` | `EXHAUSTING` | `FAILED`.

---

## 12. Replay and promotion markers

| Util | Example markers |
|------|-----------------|
| `continuation-promotion.util.ts` | ▲ CONT BUY, ▲ VWAP RECLAIM, ▲ 2ND LEG, ▲ PULLBACK HOLD |
| `autonomous-execution.util.ts` | CONT ADD, VWAP CONT, SHALLOW PB, EARLY EXP, PERSISTENCE |
| `execution-trigger.util.ts` | CONT ENTRY, SHALLOW PB, COMPRESS, RESUME |
| `replay-entry-decision.engine.ts` | FULL EXECUTION, OPENING DRIVE BUY, EARLY EXPANSION BUY, … |
| `formatReplayEventLabel()` | CONTINUATION ENTRY, SHALLOW PB HOLD, EXHAUSTION WARNING |

---

## Naming mismatches (live trading)

Documented intentional differences — do not “fix” in UI without updating this file and governance rules.

| Colloquial / expected | What code shows |
|----------------------|-----------------|
| Healthy Shallow Pullback | Group: **Healthy Shallow Pullbacks**; canonical: **Healthy Pullback Continuation**; badge: **HEALTHY PULLBACK** |
| Compression Breakout | Scanner badge **COMPRESSION BREAKOUT**; live state **Compression Ready** |
| Failed Expansion | `FAILED_EXPANSION` in terminology util; scanner **EXHAUSTION DEVELOPING** |
| Institutional Persistence | Canonical regime + badge + hero group (aligned) |
| Ready | **WATCHLIST READY**, **TREND RESUMPTION READY**, **COMPRESSION READY** (distinct ids) |
| DOMINANT NOW | State `DOMINANT_NOW` → UI **DOMINANT NOW** via `formatLabel()` |

---

## Trader cheat sheet (code-derived)

### Best entry labels

`ENTER NOW`, `FULL EXECUTION`, `PROBING EXECUTION`, `EARLY CONTINUATION ENTRY`, `HEALTHY SHALLOW PULLBACK`, `VWAP HOLD CONTINUATION`, scanner badges 🟢 HIGH CONTINUATION / INSTITUTIONAL PERSISTENCE, hero **DOMINANT NOW**, quality `IDEAL · … · FULL EDGE`, autonomous overlay with `promotedDecision` FULL/PROBING.

### Best hold labels

`TRAILING CONTINUATION HOLD`, `TRAIL CONTINUATION · HOLD PERSISTENCE`, `HOLD STRUCTURE`, `HOLD — AWAIT CONFIRMATION`, persistence **ELITE**/**STRONG**, adaptive `HOLD`.

### Best exit / trim labels

`REDUCE ON EXHAUSTION`, `REDUCE EXTENSION`, `EXIT WEAKENING`, `REDUCE SIZE`, `SCALE_PARTIAL`, `TAKE_PROFIT`, `EXIT SOON`, `EXIT NOW`, `PARTIALS`.

### Danger labels

`EXHAUSTION RISK · THIRD LEG EXTENDED`, `TRAP RISK`, `CHASE RISK · REDUCE SIZE`, `EXTENSION_WARNING`, `EXHAUSTION_DEVELOPING`, hero **EXHAUSTING** / **DEGRADING**.

### Avoid labels

`AVOID CHOP`, `AVOID TRADE`, `AVOID CHASE`, `DO NOT CHASE`, `LATE_STAGE_EXHAUSTION`, scanner `AVOID`, promotion **Exhaustion guard — no parabolic chase**, **Weak breadth risk**.

### Research-only (Phase 180)

Exit intelligence validation tab compares LEGACY / AUTONOMOUS / HYBRID exit paths; hybrid routing suggestions are advisory strings in `exit-intelligence-validation.engine.ts` — not live execution defaults.

---

## Related documentation

| Doc | Role |
|-----|------|
| [PROJECT_INTELLIGENCE_README.md](../../PROJECT_INTELLIGENCE_README.md) | Platform vision, phases, session bootstrap |
| [execution-flow.md](execution-flow.md) | Pipeline from store to execution rail |
| [decision-engine.md](decision-engine.md) | Live decision orchestration |
| [README.md](../../README.md) | Repo quick start + link to this file |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05 | Initial architecture consolidation from live codebase audit |

*When adding label families: update this file, the owning util, and `PROJECT_INTELLIGENCE_README.md` documentation index.*
