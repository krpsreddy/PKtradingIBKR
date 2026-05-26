# Phase 143 — Live Execution Decision

## Goal

Produce **ONE institutional execution decision** per live signal — conviction band, timing, sustainability, conflict resolution, and a single actionable decision label.

## New Engines

**Module:** `frontend/src/app/services/signal-intelligence/live-decision/`

| Engine | Role |
|--------|------|
| `live-decision-engine.ts` | Primary decision resolver |
| `execution-conviction.engine.ts` | Conviction score + band |
| `execution-timing-decision.engine.ts` | NOW / WAIT / TOO_LATE |
| `continuation-sustainability.engine.ts` | Sustainability level |
| `execution-conflict-resolution.engine.ts` | PROCEED / REDUCE / WAIT / AVOID |
| `institutional-entry-quality.engine.ts` | Entry quality classification |

**Orchestrator:** `execution-decision-synthesis.service.ts`

## Decision Types

`FULL_EXECUTION` · `PROBING_EXECUTION` · `WAIT_FOR_ACCEPTANCE` · `WAIT_FOR_PULLBACK` · `REDUCE_SIZE` · `AVOID_CHASE` · `AVOID_TRADE` · `TRAP_RISK`

## Conviction Bands

`ELITE` · `HIGH` · `MODERATE` · `LOW` · `AVOID`

## Integrations

- Execution Panel — primary decision banner
- Consumes overlays from Phases 137–138, 141–142, 145–148
- Edge Refinement Lab — `decisionQuality` report section
- Phase 144 replays `LiveDecisionEngine` on historical signals for audit

## Key Discoveries

- Single decision reduces cognitive load vs scattered metrics
- Entry location quality (Phase 146) and narrative quality (Phase 145) gate FULL_EXECUTION
- Phase 148 calibration can downgrade overstated conviction to REDUCE_SIZE

## Safety Constraints

- `advisoryOnly: true`
- `authoritative` when sampleCount ≥ 10
- Decisions inform human execution — never auto-trade
