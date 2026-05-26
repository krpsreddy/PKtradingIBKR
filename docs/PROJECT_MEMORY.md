# Project Memory — pktradingIBKR

> **Long-term memory for this trading platform.**  
> Update this file whenever major architecture, phases, APIs, or UX philosophy change.  
> For session continuity, see [`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md).  
> Say **"prepare session handoff"** in Cursor to refresh the handoff doc.

**Last updated:** 2026-05-25 · **Latest phase:** 169

---

## 1. System Architecture

### High-level

```
IBKR Gateway → Spring Boot (8080) → PostgreSQL
                    ↓ REST / snapshots
              Angular Dashboard (4200)
                    ↓
         Execution workspace │ Review workspace
```

**Advisory only** — no autonomous order execution. Human trader decides all actions.

### Backend modules (`src/main/java/com/tradingbot/`)

| Module | Path | Role |
|--------|------|------|
| API layer | `api/` | Dashboard, symbols, analytics, AI, journal, historical, cognition |
| Intelligence snapshots | `intelligence/snapshot/` | Phase 164 — live regime, execution cards, replay triggers (offloaded scoring) |
| Real-time execution | `intelligence/execution/realtime/` | Phase 167/169 — nano scan, feed, conviction calibration |
| Strategy memory | `services/strategymemory/` | JSON-backed autonomous strategy registry |
| Replay | `replay/`, `replay/cache/` | Historical replay engine + cached snapshots |
| Analytics storage | `analytics/storage/` | Evaluated signal persistence, opportunity explorer data |
| Analytics query | `analytics/query/` | Cross-matrix, distribution, summary queries |
| IBKR integration | `ibkr/` | Market data, connection |
| Scheduler | `scheduler/` | `NanoScannerScheduler` (1s loop) |

### Frontend modules (`frontend/src/app/`)

| Module | Path | Role |
|--------|------|------|
| Dashboard | `dashboard/` | Main execution shell, chart, sidebar wiring |
| Sidebar | `sidebar/` | Autonomous scanner, live feed, watchlist |
| Review workspace | `review/` | Institutional research tabs |
| Real-time execution | `services/real-time-execution/` | Feed polling, ranking, enrichment input |
| Autonomous scanner | `services/autonomous-regime-scanner/` | 30s snapshot scanner (Phase 165) |
| Conviction calibration | `services/conviction-calibration/` | Phase 169 — spread scores, percentile ranks |
| Action dominance | `services/action-dominance/` | ENTER NOW, ADD ON PB, etc. |
| Execution lifecycle | `services/execution-lifecycle/` | Stage timeline visualization |
| Execution intelligence | `services/execution-intelligence/` | Enriched opportunity bridge |
| Live regime | `services/live-regime-intelligence/` | Phase 162 |
| Execution triggers | `services/execution-trigger-intelligence/` | Phase 163 |
| Autonomous discovery | `services/signal-intelligence/autonomous-discovery/` | Phase 158 |
| Autonomous execution | `services/signal-intelligence/autonomous-execution/` | Phase 160 |
| Robustness | `services/signal-intelligence/robustness-validation/` | Phase 161 |
| Intelligence offload | `services/intelligence-offload/` | Backend snapshot client |
| Replay | `replay/`, `services/replay-*` | Replay panel, cache, decision visualization |
| Edge Lab | `components/global-edge-lab/` | Multi-tab research + execution feed |

### Scanners (dual pipeline — known architectural tension)

| Scanner | Frequency | Source | Used for |
|---------|-----------|--------|----------|
| **Nano scanner** | 1s (backend) + 1.5s poll (frontend) | `RealTimeExecutionEngine` | Live execution feed, top opportunity (preferred) |
| **Regime scanner** | ~30s cache | `AutonomousRegimeScannerService` + backend snapshots | Live opportunity rows, watchlist grouping |
| **Client nano** | On poll | `nano-scanner.engine.ts` | Lightweight reprioritization hints |

Pipeline: **Nano → Micro persistence → Structural confirmation → Score → Calibrate → Feed**

### Replay engine

- **Backend:** `HistoricalReplayEngine`, `IncrementalReplayService`, `ReplaySnapshotService`
- **Cache:** `ReplaySignalIndexService`, PostgreSQL replay session entities
- **Frontend:** `replay-panel`, `replay-viewport/` (Phase 150), `replay-decision-visualization/`
- Replay markers use autonomous + trigger intelligence; legacy signal colors remain for historical rows only

### Execution engine

- **Live:** `RealTimeExecutionEngine` + staged validators
- **Triggers:** `execution-trigger-intelligence/` (Phase 163)
- **Decision synthesis:** `execution-decision-synthesis.service.ts` (legacy path retained for HYBRID mode only)
- **Modes:** EARLY (pre-confirmation) vs CONFIRMED (structural pass)

### Strategy memory

- JSON: `src/main/resources/strategies/*.json`
- Service: `StrategyMemoryRegistryService` (in-memory; enable/disable, threshold patch)
- UI: `strategy-memory-panel` in Edge Lab

### Conviction scoring

- **Backend:** `AutonomousExecutionScorer` → `ConvictionCalibrationEngine` (cohort spread)
- **Frontend:** `ConvictionCalibrationEngine` + `opportunity-enrichment.engine.ts`
- **Outputs:** convictionScore, urgencyScore, rarityScore, persistenceScore, percentile rank (TOP 1% / 5% / 10% / STANDARD / WEAK)
- **Ranking:** `scannerPriority = conviction + urgency×0.35 + velocity×1.5`

### Autonomous regimes (canonical opportunity types)

See §15 below.

### Lifecycle states

**Backend maturity (`ExecutionMaturityState`):**  
`DEVELOPING` → `CONFIRMING` → `CONFIRMED` → `EXTENDED` / `EXHAUSTING` / `FAILED`

**UI lifecycle bar (`LifecycleStageId`):**  
`DEVELOPING` → `EARLY_EXPANSION` → `PERSISTENCE` → `SHALLOW_PB` → `CONFIRMED` → `ADD` → `EXTENDED` → `EXHAUSTING` → `FAILED`

---

## 2. Current Philosophy

- **Autonomous regime-driven** — ranking, coaching, filters derive from regimes + lifecycle + conviction, not OPEN_MOM/CONT buckets
- **Trader-first UX** — dominant actions (ENTER NOW, WAIT FOR ACCEPTANCE), large conviction, lifecycle bar, top card dominance
- **Lightweight continuous scanner** — 1s nano scan; no heavy replay rescoring during live mode
- **Execution mode vs research mode** — `TraderOperatingModeService`: EXECUTION hides deep research tabs; RESEARCH shows full Edge Lab analytics
- **Dual workspace** — `WorkspaceModeService`: `execution` (chart + sidebar) vs `review` (intelligence lab)
- **Advisory only** — all scores, actions, and feed items are decision support; no order placement
- **Backend offload** — heavy intelligence computed server-side (Phase 164), frontend consumes snapshots
- **Legacy adapters only** — OPEN_MOM, MOM_BUY, CONT_BUY exist in chart markers, signal table badges, HYBRID comparison path

---

## 3. Active Phases Completed (150+)

| Phase | Title | Key deliverable |
|-------|-------|-----------------|
| 150 | Replay viewport | Decoupled replay cursor / inspection / follow mode |
| 151–159 | Continuation / opening expansion | Promotion pipelines, participation scoring |
| 158 | Autonomous discovery | Unsupervised strategy mining from history |
| 160 | Autonomous execution | AUTONOMOUS_DISCOVERY mode, legacy preserved |
| 161 | Robustness validation | Overfit/regime/symbol dependency scoring |
| 162 | Live regime detection | Real-time continuation regime classification |
| 163 | Execution trigger intelligence | Tactical entry triggers (VWAP, PB, compression, etc.) |
| 164 | Backend offload | Intelligence snapshot APIs on Spring Boot |
| 165 | Trader execution UX | Autonomous regime scanner, execution cards |
| 166 | Autonomous execution shell | Regime sidebar groups, top opportunity card |
| 167 | Real-time execution engine | 1s nano scan, strategy memory, live feed |
| 168 | Review intelligence migration | Autonomous terminology, Opportunity Explorer, filters |
| 169 | Conviction calibration + UX | Calibration engine, action dominance, lifecycle bar, theme tokens, trader operating mode |

Phase docs: `docs/phases/PHASE_*.md`

---

## 4. Important APIs

### Real-time execution (Phase 167/169)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/execution/feed` | Live autonomous feed snapshot |
| GET | `/api/execution/feed/{symbol}` | Single symbol feed item |

### Strategy memory
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/strategy-memory` | List all strategies |
| GET | `/api/strategy-memory/{id}` | Single strategy |
| PATCH | `/api/strategy-memory/{id}/active` | Enable/disable |
| PATCH | `/api/strategy-memory/{id}/thresholds` | Tune thresholds (in-memory) |

### Intelligence offload (Phase 164)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/live-regime/{symbol}` | Live regime snapshot |
| GET | `/api/execution-cards/{symbol}` | Execution card snapshot |
| GET | `/api/replay-trigger/{symbol}/{session}` | Replay trigger snapshot |
| GET | `/api/replay-timeline/{symbol}/{session}` | Replay timeline |
| GET | `/api/scanner-snapshot` | Multi-symbol scanner snapshot |

### Core dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/symbols` | Watchlist symbols |
| GET | `/api/status` | System status |
| GET | `/api/momentum/*` | Legacy momentum endpoints (still present) |
| GET | `/api/analytics/*` | Session analytics |
| GET | `/api/replay-cache/*` | Cached replay sessions |
| GET | `/api/analytics-storage/*` | Opportunity explorer / signal storage |
| GET | `/api/analytics-query/*` | Query workbench |
| GET | `/api/ai/*` | AI reasoning layer |

---

## 5. Important Frontend Services

| Service | Path | Role |
|---------|------|------|
| `RealTimeExecutionService` | `real-time-execution/` | Feed poll 1.5s, enriched$, strategy memory client |
| `AutonomousRegimeScannerService` | `autonomous-regime-scanner/` | 30s scanner snapshots |
| `ConvictionCalibrationEngine` | `conviction-calibration/` | Score spread + percentile |
| `TraderOperatingModeService` | `trader-operating-mode.service.ts` | EXECUTION vs RESEARCH |
| `WorkspaceModeService` | `workspace-mode.service.ts` | execution vs review workspace |
| `ExecutionModeService` | `signal-intelligence/execution-mode.service.ts` | AUTONOMOUS vs LEGACY vs HYBRID |
| `IntelligenceOffloadService` | `intelligence-offload/` | Backend snapshot orchestration |
| `LiveRegimeSynthesisService` | `live-regime-intelligence/` | Phase 162 orchestrator |
| `ExecutionTriggerSynthesisService` | `execution-trigger-intelligence/` | Phase 163 orchestrator |
| `AutonomousDiscoverySynthesisService` | `autonomous-discovery/` | Phase 158 orchestrator |
| `RobustnessValidationSynthesisService` | `robustness-validation/` | Phase 161 orchestrator |
| `ExecutionThemeService` | `execution-theme/` | Dark theme token application |

---

## 6. Important Angular Components

| Component | Role |
|-----------|------|
| `top-autonomous-opportunity-card` | Hero top setup (conviction, action, lifecycle) |
| `autonomous-execution-card` | 3-second execution card |
| `live-execution-feed` | Sidebar + Edge Lab continuous feed |
| `live-execution-feed-row` | Calibrated feed row with lifecycle bar |
| `execution-lifecycle-bar` | Stage progression visualization |
| `strategy-memory-panel` | Strategy registry UI |
| `global-edge-lab` | Research hub (feed, memory, discovery, robustness) |
| `trading-sidebar` | Scanner + feed + watchlist |
| `review-workspace` | Review tab shell |
| `signal-intelligence-panel` | Execution Intelligence tab |
| `signal-explorer-panel` | Opportunity Explorer |
| `replay-panel` | Session replay workstation |
| `trading-chart` | Chart + markers + replay overlay |

---

## 7. Important Spring Services

| Service | Role |
|---------|------|
| `RealTimeExecutionEngine` | Nano scan orchestration, feed cache |
| `NanoAnomalyDetector` | Stage 1 — lightweight anomaly |
| `MicroPersistenceValidator` | Stage 2 — persistence validation |
| `StructuralRegimeValidator` | Stage 3 — structural confirmation |
| `AutonomousExecutionScorer` | Stage 4 — base conviction |
| `ConvictionCalibrationEngine` | Cohort spread (Phase 169) |
| `StrategyMemoryRegistryService` | Strategy JSON registry |
| `IntelligenceSnapshotService` | Offloaded intelligence snapshots |
| `IntelligenceScoringEngine` | Backend scoring for snapshots |
| `HistoricalReplayEngine` | Replay bar generation |
| `ReplaySignalIndexService` | Replay signal indexing |
| `NanoScannerScheduler` | 1-second scheduled nano tick |
| `IBKRClientService` | IBKR connection + market data |

---

## 8. Current Scanner Ranking Logic

### Nano feed (primary — Phase 167/169)

1. Backend nano tick → score → **calibrate cohort** → sort
2. Rank score: `conviction + max(0, convictionVelocity) × 1.5`
3. Frontend enrichment: calibration + action dominance + lifecycle
4. `scannerPriority = blendedConviction + urgency×0.35 + velocity×1.5`
5. Execution mode filter: hide conviction < 58 unless rising
6. EARLY vs CONFIRMED filter on feed toggle

### Regime scanner (secondary — Phase 165)

1. Backend `scanner-snapshot` every ~30s
2. `applyConvictionScores()` via calibration cohort
3. Sort: scannerPriority → expansionProbability → executionQuality
4. Sections: highContinuation, earlyExpansion, institutionalPersistence, etc.

### Percentile spread (Phase 169)

Cohort bands: 98, 95, 92, 88, 85, 82, 78, 72, 68, 65 — blended 35% raw + 65% band to avoid 67–72 clustering.

---

## 9. Known Problems

| Issue | Severity | Notes |
|-------|----------|-------|
| Dual scanner pipeline | Medium | 30s scanner + 1s feed overlap; top card uses feed, live rows may use scanner |
| Strategy threshold edits | Low | PATCH is in-memory only — not persisted to JSON files |
| Legacy chart markers | Low | MOM_BUY/OPEN_MOM colors still used for historical display |
| Angular OOM (exit 137) | Medium | Long-running dev server occasionally killed |
| ngrok URL rotation | Low | Free tier URLs change on restart; `.ngrok-urls.env` must refresh |
| Sidebar SCSS partial migration | Low | ~1200 lines; not all labels use semantic tokens yet |
| `sidebar-regime-groups.engine.ts` | Low | Orphaned for sidebar sections; still used for watchlist grouping |

---

## 10. Performance Optimizations

- **OnPush** change detection on execution cards, feed, lifecycle bar, strategy memory
- **Feed cap:** 16 items (execution mode) / 24 (research mode)
- **Poll interval:** 1.5s feed (websocket-ready architecture)
- **No replay rescoring** during live execution mode
- **Backend nano scan:** skips symbols without anomaly; no full universe rescore
- **Scanner cache TTL:** 30s (`scanner-persistence.engine.ts`)
- **Intelligence offload:** heavy work on JVM, not browser main thread
- **Memoized enrichment:** cohort calibration on poll tick only

---

## 11. Remaining TODOs

- [ ] Unify live opportunity rows onto nano feed (eliminate dual pipeline)
- [ ] Persist strategy threshold edits to JSON or DB
- [ ] WebSocket feed instead of 1.5s polling
- [ ] Virtual scroll on feed list
- [ ] Complete sidebar token migration
- [ ] Remove legacy momentum API dependency from live ranking paths
- [ ] Replay lifecycle transition animation
- [ ] Performance budget validation (<16ms frame, <100ms scanner refresh)

---

## 12. UI Philosophy

- **1-second identification** — top card must answer "what do I do?" immediately
- **Dominant action badges** — ENTER NOW, ADD ON PB, WAIT FOR ACCEPTANCE (not buried labels)
- **Conviction as hero metric** — large number, elite/strong color tiers
- **Lifecycle bar** — where am I in the trade arc?
- **Collapse noise** — fade exhaustion, hide weak conviction in execution mode
- **Execution = fast/clean** — sidebar, chart, scanner, feed, risk zones only
- **Research = institutional** — discovery, robustness, governance, replay analytics
- **Dark-first** — semantic tokens, no near-black text on dark panels

---

## 13. Color Language

### Semantic tokens (`_execution-theme.tokens.scss`)

| Token | Use |
|-------|-----|
| `--text-primary` | Main readable text |
| `--text-muted` | Labels, secondary |
| `--text-positive` | Bullish / confirmed |
| `--text-warning` | Caution / urgency |
| `--text-danger` | Exhaustion / avoid |
| `--text-accent` | Links, conviction labels |
| `--text-symbol` | Ticker symbols |

### Action colors

| Action | Token |
|--------|-------|
| ENTER | `--action-enter` (#238636) |
| ADD | `--action-add` (#1f6feb) |
| WAIT | `--action-warning` (#9e6a03) |
| REDUCE | `--action-reduce` (#db6d28) |
| EXIT | `--action-exit` (#da3633) |
| AVOID | `--action-avoid` (#6e7681) |

### Card tone borders

| Tone | Meaning |
|------|---------|
| GREEN | Confirmed continuation |
| YELLOW | Developing / confirming |
| ORANGE | Extended / late |
| RED | Exhaustion / avoid |

### Legacy badge colors (historical only)

`badge-mom`, `badge-cont`, `badge-open` in `styles.scss` — do not use for new autonomous UI.

---

## 14. Entry Lifecycle States

### Backend maturity
`DEVELOPING` → `CONFIRMING` → `CONFIRMED` → `EXTENDED` → `EXHAUSTING` / `FAILED`

### UI extended lifecycle
`DEVELOPING` → `EARLY_EXPANSION` → `PERSISTENCE` → `SHALLOW_PB` → `CONFIRMED` → `ADD` → `EXTENDED` → `EXHAUSTING` → `FAILED`

Each stage exposes: duration, stability, probability of next stage.

### Dominant actions by stage (Phase 169)
| Stage | Typical action |
|-------|----------------|
| DEVELOPING / CONFIRMING | WAIT FOR ACCEPTANCE |
| CONFIRMED | ENTER NOW |
| EXTENDED | ADD ON PB / REDUCE EXTENSION |
| EXHAUSTING | AVOID CHOP / EXIT WEAKENING |

---

## 15. Canonical Autonomous Regimes

```typescript
type AutonomousOpportunityType =
  | 'EARLY_CONTINUATION'
  | 'SHALLOW_PULLBACK_CONTINUATION'
  | 'VWAP_PERSISTENCE'
  | 'INSTITUTIONAL_ACCELERATION'
  | 'COMPRESSION_RELEASE'
  | 'TREND_RESUMPTION'
  | 'LATE_STAGE_EXHAUSTION';
```

**Trader actions:** `ENTER` | `WATCH` | `ADD` | `AVOID` | `EXIT`

**Dominant actions (Phase 169):** `ENTER` | `ADD` | `HOLD` | `WAIT` | `REDUCE` | `EXIT` | `AVOID`

**Scanner sections:** HIGH_CONTINUATION, EARLY_EXPANSION, INSTITUTIONAL_PERSISTENCE, HEALTHY_PULLBACK, COMPRESSION_BREAKOUT, EXHAUSTION_AVOID

---

## 16. Strategy Registry Structure

**Location:** `src/main/resources/strategies/*.json`

**Registered strategies:**
- `EARLY_EXPANSION`
- `SHALLOW_PULLBACK_CONTINUATION`
- `VWAP_ACCEPTANCE_PERSISTENCE`
- `COMPRESSION_BREAKOUT`
- `LATE_STAGE_EXHAUSTION`

**JSON schema (`StrategyDefinition`):**
```json
{
  "strategyId": "EARLY_EXPANSION",
  "strategyName": "Early Expansion",
  "category": "CONTINUATION",
  "conditions": ["..."],
  "thresholds": { "minRvol": 1.8, "minExpansionProbability": 55 },
  "winRate": 0.62,
  "avgR": 1.4,
  "robustness": 0.71,
  "active": true,
  "deprecated": false,
  "replayExamples": ["NVDA", "AMD"],
  "discoveredFromPhase": 165,
  "notes": "...",
  "version": 1,
  "governanceTags": ["AUTONOMOUS", "INTRACANDLE"]
}
```

---

## 17. Replay Architecture

```
Historical bars (IBKR/DB)
  → HistoricalReplayEngine
  → ReplaySnapshotService (cache to PostgreSQL)
  → Frontend ReplayPanel
      → replay-viewport state machine (Phase 150)
      → replay-decision-visualization (trigger markers)
      → replay-trigger snapshots (Phase 164 backend)
```

- **Incremental replay:** `IncrementalReplayService` for partial session updates
- **Signal index:** `ReplaySignalIndexService` + frontend `multi-session-signal-index.engine.ts`
- **Lazy analytics:** `lazy-analytics-enrichment.service.ts` — no full rescore on scrub
- **Replay markers:** autonomous purple + trigger colors; legacy types for old signals

---

## 18. Current Active Feature Flags / Modes

| Flag / Mode | Service | Values | Default |
|-------------|---------|--------|---------|
| Execution framework | `ExecutionModeService` | AUTONOMOUS_DISCOVERY, LEGACY_GOVERNANCE, HYBRID_COMPARISON | AUTONOMOUS_DISCOVERY |
| Workspace | `WorkspaceModeService` | execution, review | execution |
| Trader operating | `TraderOperatingModeService` | EXECUTION, RESEARCH | EXECUTION |
| Feed framework | `RealTimeExecutionService` | EARLY, CONFIRMED | CONFIRMED |
| AI layer | `application.properties` | `ai.enabled=true`, provider=ollama | on |
| ngrok dev | `environment.ngrok.ts` | relative `/api` + proxy | off unless ngrok serve |

---

## Maintenance Rules

When completing a new phase, append to this document:

1. **Goals** — what problem was solved
2. **Architecture** — new modules, data flow
3. **APIs** — new/changed endpoints
4. **UI changes** — components, tokens, modes
5. **Unresolved issues** — move to §9 and SESSION_HANDOFF

Update **Last updated** date and **Latest phase** number at the top.

---

## Dev Infrastructure

- **ngrok:** `dev/ngrok/` — dual tunnel setup (frontend 4200, backend 8080)
- **ngrok API proxy:** `proxy.conf.ngrok.json` — `/api` → localhost:8080 (avoids CORS)
- **Spring ngrok profile:** `application-ngrok.properties.example`
