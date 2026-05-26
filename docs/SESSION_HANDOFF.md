# Session Handoff — pktradingIBKR

> **Purpose:** Everything needed to continue in a fresh Cursor chat.  
> **Refresh:** Say **"prepare session handoff"** to update this file.  
> **Long-term memory:** [`PROJECT_MEMORY.md`](./PROJECT_MEMORY.md)

**Handoff date:** 2026-05-25  
**Latest completed phase:** 169 — Conviction Calibration + Trader UX Stabilization

---

## Latest Completed Phase (169)

### Goals
- Spread flat conviction clusters (67–72) into actionable ranks (95+, 90+, etc.)
- Dominant trader actions (ENTER NOW, ADD ON PB, WAIT FOR ACCEPTANCE)
- Lifecycle visualization bar on cards and feed
- Dark theme semantic tokens
- Execution vs research operating mode separation
- Unify top opportunity with nano feed #1

### Architecture added
| Layer | Path |
|-------|------|
| Conviction calibration (FE) | `frontend/src/app/services/conviction-calibration/` |
| Conviction calibration (BE) | `src/main/java/.../ConvictionCalibrationEngine.java` |
| Action dominance | `frontend/src/app/services/action-dominance/` |
| Lifecycle engine | `frontend/src/app/services/execution-lifecycle/` |
| Enrichment pipeline | `frontend/src/app/services/execution-intelligence/` |
| Lifecycle bar component | `frontend/src/app/components/execution-lifecycle-bar/` |
| Theme tokens | `frontend/src/app/styles/_execution-theme.tokens.scss` |
| Trader operating mode | `frontend/src/app/services/trader-operating-mode.service.ts` |

### APIs added/changed
- `PATCH /api/strategy-memory/{id}/thresholds` — in-memory threshold tuning

### UI changes
- Hero top card with conviction, dominant action, lifecycle bar, rarity badge
- Feed rows show calibrated conviction, urgency, lifecycle bar
- Confirmed/Early toggle now interactive
- Review tabs filtered by `TraderOperatingModeService` in execution mode
- Semantic dark theme tokens on sidebar, feed, cards

### Unresolved from Phase 169
- Dual scanner pipeline (30s + 1s) not fully unified
- Strategy threshold PATCH not persisted to disk
- Sidebar SCSS not fully tokenized

---

## Latest Architectural Decisions

1. **Nano feed is primary** for top opportunity and live execution feed; 30s scanner remains for live opportunity rows and watchlist grouping.
2. **Conviction calibrated twice** — backend cohort spread on feed build, frontend enrichment on poll.
3. **No legacy OPEN_MOM/CONT in live ranking** — only in chart marker adapters and HYBRID comparison mode.
4. **Advisory only** — no order execution endpoints; all actions are UI guidance.
5. **Backend offload (164)** — intelligence snapshots computed on JVM; browser consumes REST.
6. **ngrok dev** — API calls use relative `/api` proxied through Angular dev server (not direct localhost:8080 from browser).

---

## Active Bugs / Issues

| Bug | Status | Workaround |
|-----|--------|------------|
| Angular dev server OOM (exit 137) | Intermittent | Restart `npm start` |
| ngrok free URLs change on restart | Expected | Re-read `dev/ngrok/.ngrok-urls.env` |
| Live opportunity rows may still use 30s scanner data | Known | Phase 170 unification |
| Spring Boot must run locally for ngrok proxy | Expected | `mvn spring-boot:run` on :8080 |

---

## Next Priorities

1. **Phase 170 (suggested):** Unify live opportunity rows onto nano feed — single pipeline
2. Persist strategy memory threshold edits to JSON/DB
3. WebSocket execution feed (replace 1.5s poll)
4. Virtual scroll on feed + collapse weak rows by default
5. Complete legacy removal from chart live markers (keep replay history only)
6. Replay lifecycle transition animation

---

## Current Scanner Behavior

### Backend (1s — `NanoScannerScheduler`)
```
For each symbol in scan set:
  1. NanoAnomalyDetector.detect()
  2. MicroPersistenceValidator.validate()
  3. StructuralRegimeValidator.validate() (if anomaly)
  4. AutonomousExecutionScorer.score()
  5. ConvictionCalibrationEngine.calibrateCohort()
  6. Sort by conviction + velocity×1.5
  7. Cache top 40 in feed
```

### Frontend (1.5s poll — `RealTimeExecutionService`)
```
GET /api/execution/feed
  → visibleEnrichedFeed() with calibration + action + lifecycle
  → enriched$ BehaviorSubject
  → live-execution-feed, top-autonomous-opportunity-card
```

### Secondary scanner (30s — `AutonomousRegimeScannerService`)
```
GET /api/scanner-snapshot (via intelligence offload)
  → buildScannerCard() per symbol
  → applyConvictionScores() with calibration
  → bucketBySection()
  → used for live-opportunity-card rows, autonomousCards map
```

### Ranking formula (both paths after Phase 169)
- Cohort percentile spread: bands 98→65
- Priority: `scannerPriority = conviction + urgency×0.35 + velocity×1.5`

---

## Pending Migrations

| Item | From | To | Status |
|------|------|-----|--------|
| Live opportunity rows | 30s scanner | Nano feed enriched | Pending |
| Review filters | Legacy keys (storage) | Autonomous keys | Done (168) — `migrateLegacyWorkflowFilters` |
| Sidebar regime sections | Static buckets | Live feed | Done (167) |
| Top card data source | Scanner snapshot | Nano feed #1 | Done (169) |
| Chart live markers | Legacy signal types | Autonomous regime markers | Partial |
| Strategy thresholds | In-memory PATCH | JSON persistence | Pending |

---

## How to Run (Current)

```bash
# Backend
mvn spring-boot:run

# Frontend (local)
cd frontend && npm start

# Frontend (ngrok — auto-detects dev/ngrok/.ngrok-urls.env)
cd frontend && npm start   # uses ngrok config if .ngrok-urls.env exists

# ngrok tunnels
cd dev/ngrok && ./scripts/start-all-background.sh

# Spring with ngrok CORS (optional if using proxy)
export $(grep -v '^#' dev/ngrok/.ngrok-urls.env | xargs)
SPRING_PROFILES_ACTIVE=ngrok mvn spring-boot:run
```

**Current ngrok URLs** (change on restart — check `.ngrok-urls.env`):
- Frontend: see `NGROK_FRONTEND_URL`
- Backend: see `NGROK_BACKEND_URL`
- Basic auth: `dev/ngrok/.env`

---

## Key Files to Read First in a New Session

| Priority | File | Why |
|----------|------|-----|
| 1 | `docs/PROJECT_MEMORY.md` | Full architecture |
| 2 | `docs/phases/PHASE_169_*.md` | Latest phase |
| 3 | `RealTimeExecutionEngine.java` | Live scanner backend |
| 4 | `real-time-execution.service.ts` | Feed client |
| 5 | `opportunity-enrichment.engine.ts` | Calibration + action bridge |
| 6 | `trading-sidebar.component.ts` | Sidebar wiring |
| 7 | `dashboard.component.ts` | Main shell integration |

---

## Phase History Quick Reference (150–169)

150 Replay viewport · 158 Discovery · 160 Autonomous execution · 161 Robustness · 162 Live regime · 163 Triggers · 164 Backend offload · 165 Scanner UX · 166 Execution shell · 167 Realtime engine · 168 Review migration · 169 Conviction UX

Full docs: `docs/phases/`

---

## Cursor Instructions

When starting a fresh chat:
1. Read `docs/PROJECT_MEMORY.md` and this file
2. Check `docs/phases/PHASE_*` for the target phase
3. Run builds: `mvn compile` + `cd frontend && npm run build`
4. Backend changes require Spring Boot restart
5. Do not commit `.env`, `application-local.properties`, or ngrok secrets

When user says **"prepare session handoff"**:
- Update this file with latest phase, bugs, priorities, scanner behavior, and pending migrations
- Update `PROJECT_MEMORY.md` §9 (known problems) and §11 (TODOs) if changed
