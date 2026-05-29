# Phases 196–200 — Execution intelligence (no UI)

Backend-only refinement toward a consistently profitable **1-share paper** execution engine.

## Packages

| Phase | Package | Components |
|-------|---------|------------|
| 196 | `marketstructure` | `MarketStructureEngine`, `MarketStructureClassifier`, `MarketEnvironmentState` |
| 197 | `entry` | `EntryQualityEngine`, `EntryQualityState` |
| 198 | `exit` | `ExitIntelligenceEngine`, `ExitState`, `PaperExecutionExitService` |
| 199 | `reliability` | `RegimeReliabilityLearningEngine` (feeds `RegimeReliabilityEngine`) |
| 200 | `refinement` | `ExecutionRefinementEngine`, `ContinuationCaptureEfficiency` |
| — | `executionintelligence` | `ExecutionIntelligenceCoordinator` (wiring) |

## Auto-execution gates (unchanged sizing)

- **1 share** paper only
- **Top-1** orchestrated slot
- Auto entry only when `EntryQualityState` ∈ {IDEAL, EARLY, CONFIRMED}
- Macro structure must allow opportunity regime
- Adjusted conviction/dominance must pass portfolio thresholds

## Continuation capture metric (Phase 200)

```
ContinuationCaptureEfficiency = realizedR / mfeR  (capped 0–1.5)
```

Logged on adaptive exits via `exitQualityNote` and refinement notes.

## Adaptive exits (Phase 198)

`PaperExecutionExitService` polls open paper positions every `paper-execution.exit-poll-ms` (default 8s) and may close on:

- Persistence failure / exhaustion
- VWAP failure
- Give-back after partial winner
- Risk breach

## Integration points

- `LiveScannerService.refresh()` — refreshes macro structure assessment
- `RealtimeRegimeEngine` — structure modifier on live boost
- `LiveTraderOpportunityEnricher` — adjusted conviction/dominance
- `PortfolioDecisionEngine` — intelligence gates on execute/queue
- `LiveTraderAutoExecutionHook` — blocks non-ideal entries

## No UI changes

Existing Flutter live trader and Angular replay lab surfaces are unchanged; intelligence runs server-side only.
