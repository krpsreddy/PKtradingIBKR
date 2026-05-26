# Adaptive Execution Intelligence Platform

> **Canonical reference for Cursor sessions.** Read this file first before implementing new phases or modifying intelligence systems.

Last updated: Phase 154 (Winner Decomposition) · May 2026

---

## Vision

This platform transforms raw IBKR market data and signal replay into **institutional-grade execution intelligence** — advisory analytics that help a human trader decide *when*, *where*, and *how aggressively* to execute, without ever placing trades automatically.

Core goals:

- **Institutional-grade execution intelligence** — conviction, timing, narrative, entry location, and calibration overlays
- **Advisory-only analytics** — every intelligence module sets `advisoryOnly: true`; no order routing
- **No auto-trading** — gates, decisions, and playbooks inform; they do not execute
- **Narrative-aware execution optimization** — market state paths drive entry and aggression guidance
- **Execution calibration and playbook discovery** — self-auditing feedback loops and statistically discovered playbooks for human review
- **Persistent analytics** — PostgreSQL-backed storage so intelligence survives browser sessions

---

## Section 1 — Core Principles

| Principle | Enforcement |
|-----------|-------------|
| `advisoryOnly: true` | Literal type on all report/snapshot interfaces; no exceptions in intelligence modules |
| Deterministic analytics authoritative | Historical engines + math utilities produce reports; AI summaries are secondary |
| No AI trade execution | AI may summarize; it never triggers orders or threshold changes |
| No auto strategy mutation | Suppression simulations recommend; they do not apply rules live |
| Statistical safety | `n < 10` → never authoritative; `n < 25` → LOW confidence labels |
| Confidence gating | `authoritative` flags, `ConfidenceRating` levels, sample floors in engines |
| Human review required | Playbook promotion: DISCOVERED → REVIEWED → APPROVED → ACTIVE (manual only) |

**Never introduce:** auto-trading, auto-threshold mutation, auto-playbook activation, or silent strategy changes.

---

## Section 2 — Architecture Overview

### Frontend (Angular)

| Area | Path / Component |
|------|------------------|
| Signal intelligence modules | `frontend/src/app/services/signal-intelligence/` |
| Execution rail | `components/execution-panel/` + `ExecutionAdvisoryAnalyticsService` |
| Edge Refinement Lab | `components/edge-refinement-lab/` · Review tab `edge-refinement` |
| Playbook Lab | `components/playbook-lab/` · Review tab `playbook-lab` |
| Trade Timeline | `components/trade-lifecycle-lab/` · Review tab `trade-timeline` |
| Bulk hydration | `ai/services/hydration/bulk-history-hydration.service.ts` |
| Global Edge Lab | `components/global-edge-lab/` |

### Backend (Spring Boot + PostgreSQL)

| Area | Path |
|------|------|
| Analytics persistence | `src/main/java/com/tradingbot/analytics/storage/` |
| REST API | `GET/POST /api/analytics-storage/*` |
| Candle history | `CandleHistoryService` · `candles` table |
| Historical replay | `HistoricalReplayEngine` · `GET /replay/bulk/{symbol}` |
| IBKR integration | `IBKRClientService` · `HistoricalDataService` |

### Data flow

```
IBKR Gateway
    → 5m candles stored in PostgreSQL
    → Incremental replay (Phase 149) — cache-first, stale sessions only
    → Frontend signal evaluation (WIN/LOSS/NEUTRAL)
    → SignalIntelligenceStore (+ localStorage cache)
    → AnalyticsSyncService → PostgreSQL evaluated snapshots
    → Intelligence engines (60D lookback) — lazy enrichment after render
    → Execution rail + Edge Lab + Playbook Lab + Trade Timeline
```

**Hydration note:** "Downloading replay" in the UI means **CPU replay from local DB**, not IBKR download. First full hydration of 30 symbols × 44 sessions is compute-heavy (~6 min at 4× parallelism).

---

## Section 3 — Implemented Phases (137–148)

Detailed per-phase docs: [`docs/phases/`](docs/phases/)

| Phase | Name | Doc |
|-------|------|-----|
| 137 | Live Execution Gate | [PHASE_137.md](docs/phases/PHASE_137.md) |
| 138 | Confidence-Weighted Governance | [PHASE_138.md](docs/phases/PHASE_138.md) |
| 139 | Playbook Discovery | [PHASE_139.md](docs/phases/PHASE_139.md) |
| 140 | Trade Lifecycle Intelligence | [PHASE_140.md](docs/phases/PHASE_140.md) |
| 141 | Execution Quality + Edge Refinement | [PHASE_141.md](docs/phases/PHASE_141.md) |
| 142 | Entry Acceptance Sequencing | [PHASE_142.md](docs/phases/PHASE_142.md) |
| 143 | Live Execution Decision | [PHASE_143.md](docs/phases/PHASE_143.md) |
| 144 | Decision Feedback Loop | [PHASE_144.md](docs/phases/PHASE_144.md) |
| 145 | Market State + Narrative Engine | [PHASE_145.md](docs/phases/PHASE_145.md) |
| 146 | Adaptive Entry Optimization | [PHASE_146.md](docs/phases/PHASE_146.md) |
| 147 | Persistent Analytics Storage | [PHASE_147.md](docs/phases/PHASE_147.md) |
| 148 | Adaptive Calibration Engine | [PHASE_148.md](docs/phases/PHASE_148.md) |
| 149 | Incremental Replay + Replay Cache | [PHASE_149.md](docs/phases/PHASE_149.md) |

### Phase dependency (live path)

```
Store → Live Gate (137/138) → Exec Quality (141) → Entry Sequencing (142)
     → Market State (145) → Adaptive Entry (146) → Calibration (148)
     → Live Decision (143) → Decision Feedback (144) → Execution Panel
```

---

## Section 4 — Current Intelligence Systems

| Module | Purpose | Key orchestrator | Primary outputs | Integrations |
|--------|---------|------------------|-----------------|--------------|
| **live-execution** | Real-time edge gate + governance | `LiveExecutionGateService` | `LiveExecutionGateSnapshot` | Execution panel, live decision context |
| **execution-quality** | Entry classification + chase/reclaim quality | `ExecutionQualitySynthesisService` | `ExecutionQualityReport`, live intel | Edge lab, live decision |
| **edge-refinement** | Suppression validation + simulations | `EdgeRefinementReportService` | `EdgeRefinementReport` | Edge Refinement Lab (aggregates 141–148) |
| **entry-sequencing** | Acceptance states + second-leg | `EntrySequencingSynthesisService` | Sequencing report, live intel | Market state, live decision, decision feedback |
| **live-decision** | Single actionable decision | `ExecutionDecisionSynthesisService` | `LiveExecutionDecisionSnapshot` | Execution panel banner |
| **decision-feedback** | Self-audit past decisions | `DecisionFeedbackSynthesisService` | Audit rows, regret, wait-vs-act | Edge lab, adaptive insight line |
| **market-state** | Narrative state machine | `MarketStateSynthesisService` | State paths, trajectories, playbooks | Execution rail narrative, adaptive entry |
| **adaptive-entry** | Entry window + location optimization | `EntryOptimizationSynthesisService` | Entry zones, missed expansion | Live decision, edge lab |
| **adaptive-calibration** | Conviction/wait/suppression calibration | `AdaptiveCalibrationSynthesisService` | Calibration report, playbook profiles | Live decision overlays, edge lab, playbook lab |
| **playbook-discovery** | Statistical playbook candidates | `PlaybookDiscoveryService` | `PlaybookCandidate[]` | Playbook Lab, backend persistence |
| **trade-lifecycle** | Per-trade attribution + coaching | `TradeLifecycleService` | Lifecycle snapshots, coaching | Trade Timeline, execution coaching panel |
| **persistent-analytics** | Backend sync + migration | `AnalyticsSyncService` | Server-backed store bootstrap | App init, hydration persistence |
| **replay-cache** | Incremental replay snapshots | `IncrementalHydrationService` | Cache-first bulk replay | Hydration, symbol edge backfill |
| **edge-discovery** | Daily edge clusters + capital ranking | `DailyEdgeDiscoveryReportService` | Discovery gates | Execution advisory |
| **winner-decomposition** | Expansion winner preconditions + suppression diagnostics | `WinnerDecompositionSynthesisService` | `WinnerDecompositionReport` | Global Edge Lab — Winner Decomposition Analytics |
| **continuation-promotion** | Statistical continuation governance rebalance + chart entry promotion | `ContinuationPromotionSynthesisService` | `ContinuationPromotionReport` | Live/replay chart markers, execution rail, Edge Lab |

---

## Continuation Promotion (Phase 155)

Statistically calibrates governance to **participate in elite continuation trends** instead of suppressing them as exhaustion.

- Distinguishes **healthy continuation digestion** vs **true exhaustion**
- Promotes WAIT/AVOID → FULL_EXECUTION when archetype stats pass thresholds
- Renders **chart-visible continuation entry markers** in live + replay
- Integrates with execution rail promotion banner

See [`docs/phases/PHASE_155_CONTINUATION_PROMOTION.md`](docs/phases/PHASE_155_CONTINUATION_PROMOTION.md).

**Expansion capture discovery system** — analyzes GT_2R+ winners to extract **pre-entry** conditions (entry location, market structure, indicators, narrative, governance state) at signal fire time.

| Engine | Purpose |
|--------|---------|
| `ExpansionWinnerQueryService` | Query GT_2R+ / low-fakeout runners from evaluated store |
| `ContinuationPreconditionEngine` | Elite entry conditions + expansion condition matrix |
| `SuppressionFailureAnalysisEngine` | Missed winners, governance failures, false avoids |
| `WinnerConditionClusteringEngine` | Narrative clusters + trend persistence analytics |
| `EliteExpansionProfileEngine` | Recommended profiles + AMD 340→355 / 396→425 case studies |
| `EntryRecaptureEngine` | Where FULL_EXECUTION should have occurred |

**Governance suppression diagnostics:** identifies WAIT/AVOID/REDUCE decisions on sessions that later became >2R winners — advisory only, n&lt;10 not authoritative.

See [`docs/phases/PHASE_154.md`](docs/phases/PHASE_154.md).

---

## Section 5 — Important Analytical Discoveries

Persisted in [`docs/discoveries/`](docs/discoveries/):

- **Momentum profitable only after reclaim confirmation** — instant breakout entries underperform vs reclaim-hold
- **Waiting too conservative in some environments** — governance false-avoids continuation winners
- **Second-leg acceptance strongest continuation** — best survival vs first-leg chase
- **Opening extensions unstable** — conviction downgrade required in extension narratives
- **Trap locations dangerous** — TRAP_RISK suppression well-calibrated; CHASE suppression often unsafe
- **Reclaim-hold improves expectancy** — wait-for-acceptance reduces fakeouts with expansion cost
- **Narrative stability critical** — unstable/failing narratives require conviction downgrade

---

## Section 6 — Data Storage Model

See [`docs/architecture/analytics-persistence.md`](docs/architecture/analytics-persistence.md).

| Store | Location | Contents |
|-------|----------|----------|
| PostgreSQL `candles` | Backend JPA | Raw 5m OHLCV history |
| PostgreSQL `evaluated_signal_snapshots` | Phase 147 | Full signal JSON + indexed fields |
| PostgreSQL `hydration_sessions` | Phase 147 | Per-symbol 60D hydration metadata |
| PostgreSQL `playbook_candidates` | Phase 147 | Discovered playbook payloads |
| PostgreSQL `decision_feedback_snapshots` | Phase 147 | Decision audit snapshots |
| Browser `localStorage` | Frontend cache | `pk-signal-intelligence-v1`, hydration state (cache; server wins) |
| `analyticsVersion` | Backend + frontend | `CURRENT_VERSION = 1`; stale flag on mismatch |

**Sync strategy:** `AnalyticsSyncService.bootstrap()` loads server → merges into store; debounced bulk upsert on revision; localStorage migration on empty server.

---

## Section 7 — Execution Rail Logic

See [`docs/architecture/execution-flow.md`](docs/architecture/execution-flow.md) and [`docs/architecture/decision-engine.md`](docs/architecture/decision-engine.md).

**Hierarchy (Execution Panel):**

1. **Live decision banner** — FULL EXECUTION · conviction band · timing
2. **Narrative overlay** — market state transition + institutional flow label
3. **Adaptive entry line** — entry location guidance
4. **Adaptive insight line** — decision feedback self-audit
5. **Calibration line** — conviction/governance calibration guidance
6. **Fallback** — live gate banner + lifecycle coach when no live decision

**Live decision inputs:** gate (137/138), exec quality (141), sequencing (142), market state (145), adaptive entry (146), calibration (148).

---

## Section 8 — Playbook Philosophy

- **Discovered statistically** — recurring profitable condition sequences from 60D history
- **Never auto-promoted** — human moves DISCOVERED → REVIEWED → APPROVED → ACTIVE
- **Human review required** — Playbook Lab is the review surface
- **Narrative-driven** — `NarrativePlaybookEngine` links state paths to playbook keys
- **Optimal entry zones** — Phase 146 `PlaybookEntryZone[]` per narrative playbook
- **Calibration profiles** — Phase 148 maps aggression/conviction/wait bias per playbook type

Qualification floors (Phase 139): `n ≥ 10`, expectancy ≥ 0.35R, fakeout ≤ 45%, ≥ 3 symbols/sessions.

---

## Section 9 — Future Roadmap

| Area | Status |
|------|--------|
| Calibration refinement | Ongoing — Phase 148 baseline |
| Incremental replay cache | **Done** — Phase 149 |
| Backend replay skip (incremental sessions) | Implemented — stale-only replay |
| Institutional flow analysis | Partial — Phase 145 engine exists; deeper integration TBD |
| Long-horizon analytics | Not started — beyond 60D lookback |
| Multi-timeframe narratives | Not started |
| AI summarization (advisory only) | Partial — symbol edge AI summaries exist; expand cautiously |
| Sync status UI in Edge Lab | Optional enhancement |
| Phase 149+ | Append to this README and `docs/phases/` when implemented |

---

## Section 10 — Session Continuity Guide

### Future session startup order

Read in this order before modifying scanner, execution, replay, sidebar, regime, or execution-plan systems:

1. **`PROJECT_INTELLIGENCE_README.md`** (this file) — vision, phases, constraints, hubs
2. **`docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md`** — canonical trader labels, regime language, source-of-truth ownership, migration status
3. **Latest PHASE docs** — `docs/phases/` for the subsystem you are extending (highest phase number first)
4. **Relevant architecture docs** — `docs/architecture/` (execution-flow, decision-engine, replay-cache, etc.)

**When starting a new Cursor session:**

1. **Read `PROJECT_INTELLIGENCE_README.md` first** (this file)
2. **Read `docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md`** before any trader-facing label or regime naming work
3. **Read the relevant phase doc** in `docs/phases/` if extending a specific system
3. **Use existing architecture patterns:**
   - `*.models.ts` → `*.engine.ts` (pure) → `*-synthesis.service.ts` (injectable)
   - `refresh()` for lab reports · `liveIntel()` for execution rail
   - Subscribe to `SignalIntelligenceStore.revision$`
4. **Preserve advisory-only constraints** — every new snapshot type needs `advisoryOnly: true`
5. **Preserve deterministic analytics authority** — engines over AI for metrics
6. **Do not introduce auto-trading** — no order placement, no live rule mutation
7. **Maintain statistical safety** — `MIN_AUTHORITATIVE = 10`, `MIN_LOW_CONFIDENCE = 25`
8. **Integrate via established hubs:**
   - Lab: `EdgeRefinementReportService.buildReport()`
   - Live: `ExecutionAdvisoryAnalyticsService.forSymbol()`
   - Decision: `LiveDecisionContext` overlay fields + `LiveDecisionEngine.resolveDecision()`
9. **After completing a new phase:** append to Section 3 table, create `docs/phases/PHASE_NNN.md`, update architecture docs if flow changes

### Key file paths (quick reference)

```
frontend/src/app/services/signal-intelligence/     # All intelligence modules
frontend/src/app/services/signal-intelligence/execution-advisory-analytics.service.ts  # Live hub
frontend/src/app/services/signal-intelligence/edge-refinement/edge-refinement-report.service.ts  # Lab hub
frontend/src/app/components/execution-panel/       # Execution rail UI
frontend/src/app/components/edge-refinement-lab/   # Edge Lab UI
src/main/java/com/tradingbot/analytics/storage/  # Backend persistence
src/main/java/com/tradingbot/replay/HistoricalReplayEngine.java  # Bulk replay
```

---

## Documentation index

| Path | Contents |
|------|----------|
| [`docs/phases/`](docs/phases/) | Per-phase architecture, engines, integrations |
| [`docs/architecture/`](docs/architecture/) | System flow, persistence, decision engine, narratives |
| [`docs/discoveries/`](docs/discoveries/) | Analytical findings over time |

### Architecture / docs references

| Document | Purpose |
|----------|---------|
| [Autonomous Execution Terminology](docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md) | **Canonical** trader terminology, regime language, execution labels, governance, migration status |
| [execution-flow.md](docs/architecture/execution-flow.md) | End-to-end execution intelligence pipeline |
| [decision-engine.md](docs/architecture/decision-engine.md) | Live decision orchestration |
| [replay-cache.md](docs/architecture/replay-cache.md) | Incremental replay and cache |
| [analytics-persistence.md](docs/architecture/analytics-persistence.md) | PostgreSQL analytics storage |
| [narrative-system.md](docs/architecture/narrative-system.md) | Market state and narrative paths |

**Cursor agents:** Future sessions should read [AUTONOMOUS_EXECUTION_TERMINOLOGY.md](docs/architecture/AUTONOMOUS_EXECUTION_TERMINOLOGY.md) before modifying scanner, execution, replay, sidebar, regime, or execution-plan systems.

---

*This document is the long-term memory of the project. Update it when adding Phase 149+.*
