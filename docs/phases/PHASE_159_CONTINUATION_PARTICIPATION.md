# Phase 159 — Continuation Participation Engine

**Status:** Implemented · Advisory only

Converts Phase 158 autonomous discovery findings into live/replay continuation participation overlays.

## Module

`frontend/src/app/services/signal-intelligence/continuation-participation/`

## Participation Signals

CONTINUATION_ADD · EARLY_EXPANSION_ENTRY · VWAP_ACCEPTANCE_CONTINUATION · SHALLOW_PULLBACK_CONTINUATION · HIGH_RVOL_CONTINUATION · PERSISTENCE_ENTRY

## Integration

- `ExecutionDecisionSynthesisService` (autonomous/hybrid modes)
- `ReplayEntryDecisionEngine` — cyan markers (CONT ADD, VWAP CONT, PERSISTENCE)
- Global Edge Lab — Continuation Participation Analytics
- Execution rail — participation promotion lines

## Safety

Exhaustion guard blocks parabolic chase. n < 10 insufficient · n < 25 low confidence.
