# Phase 152 — Professional Replay Decision Visualization

## Goal

Transform replay from candle playback into institutional trade review with decision-quality overlays, exit markers, multi-day context, and session health.

## Module

`frontend/src/app/services/replay-decision-visualization/`

| Engine / Service | Role |
|------------------|------|
| `ReplayEntryDecisionEngine` | FULL EXEC / PROBE / WAIT / TRAP / REDUCE classification |
| `ReplayExitVisualizationEngine` | EXIT / STOP / TARGET / BREAKDOWN markers |
| `ReplaySignalOverlayEngine` | Professional chart markers (replaces tiny MOM labels) |
| `ReplayDecisionTimelineEngine` | Decision timeline rows below chart |
| `ReplayNarrativeOverlayEngine` | Narrative bands on chart canvas |
| `ReplayMultiDayContextEngine` | Previous day / 3-day / week context candles |
| `ReplaySessionHealthEngine` | Session dropdown health labels |
| `ReplayTimeAxisLayoutEngine` | Time scale visibility fixes |
| `ReplayProfessionalReviewService` | Orchestrator |

## Backend

`GET /api/replay-cache/session-summary/{symbol}` — enriched session catalog with real signal counts from snapshot timeline, conviction avg, status (READY, CACHE_ONLY, PARTIAL, etc.)

## UX changes

- **Entry markers:** `▲ FULL EXEC · 84% · RECLAIM` instead of `🚀 MOM`
- **Exit markers:** `▼ EXIT`, `▼ STOP`, `🏁 TARGET` with R-multiple hints
- **Decision timeline panel** — click row to scrub to bar
- **Review summary bar** — session type, best setup/entry/exit, replay quality
- **Previous day context** — default `PREVIOUS_DAY` context mode on load
- **Study / Training modes** — all signals vs progressive reveal
- **Session dropdown** — `May 22 · 17 signals · Replay Cached · 78% conv`
- **Hover tooltip** — conviction, narrative, entry quality, fakeout risk, expected R
- **Time axis** — increased bottom margin, dedicated replay layout

## Constraints

Visualization/UX only — no strategy, threshold, or decision engine mutation.
