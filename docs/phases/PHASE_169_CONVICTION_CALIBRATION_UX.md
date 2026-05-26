# Phase 169 — Conviction Calibration + Trader UX Stabilization

**Status:** Implemented (advisory only — no autonomous order execution)

## Architecture Summary

Phase 169 refines the autonomous execution platform into a trader-first operating system by unifying conviction scoring, dominant actions, lifecycle visualization, theme tokens, and execution/research mode separation.

### New Frontend Modules

| Module | Path | Role |
|--------|------|------|
| Theme tokens | `frontend/src/app/styles/_execution-theme.tokens.scss` | Semantic `--text-*`, `--bg-*`, `--action-*` tokens |
| Theme service | `services/execution-theme/execution-theme.service.ts` | Applies dark theme class at bootstrap |
| Conviction calibration | `services/conviction-calibration/` | Spreads flat 67–72 clusters via cohort percentile bands |
| Action dominance | `services/action-dominance/` | ENTER NOW, ADD ON PB, WAIT FOR ACCEPTANCE, etc. |
| Lifecycle engine | `services/execution-lifecycle/` | DEVELOPING → … → EXHAUSTING timeline |
| Enrichment pipeline | `services/execution-intelligence/` | Unifies feed + scanner into `EnrichedOpportunity` |
| Nano scanner (client) | `services/real-time-execution/nano-scanner.engine.ts` | Lightweight reprioritization inputs |
| Trader operating mode | `services/trader-operating-mode.service.ts` | EXECUTION vs RESEARCH tab visibility |
| Lifecycle bar | `components/execution-lifecycle-bar/` | Visual stage progression |

### Backend

| Module | Path | Role |
|--------|------|------|
| ConvictionCalibrationEngine | `intelligence/execution/realtime/ConvictionCalibrationEngine.java` | Server-side cohort spread before feed ranking |
| Strategy thresholds API | `PATCH /api/strategy-memory/{id}/thresholds` | In-memory threshold + notes tuning |

## Migration Notes

- Top card now prefers nano feed #1 via `topEnrichedOpportunity` (dashboard `enriched$` subscription)
- Conviction calibrated on both frontend enrichment and backend feed build
- Live feed Confirmed/Early toggle is interactive
- Theme tokens replace hardcoded label colors in sidebar, feed, cards, strategy memory

## Legacy Dependency Report

| Surface | Status |
|---------|--------|
| Review / filters / coaching | Migrated (Phase 168) |
| Chart historical markers | Legacy adapter for display only |
| Signal table badges | Legacy CSS mapping for history rows |
| Live decision synthesis | Legacy path retained for A/B comparison |

Live ranking/scoring derives from autonomous regimes + calibration.

## Performance

- OnPush on all new components
- Enrichment on 1.5s poll only — no replay rescoring in live mode
- Feed capped: 16 (execution) / 24 (research)

## Verification

```bash
cd frontend && npm run build
mvn -q compile
```
