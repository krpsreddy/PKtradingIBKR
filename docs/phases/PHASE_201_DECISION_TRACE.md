# Phase 201 — Decision trace & execution reasoning (no UI)

Backend-only explainable execution intelligence: every entry, exit, rejection, queue, and replacement advisory persists full reasoning context.

## Package `decisiontrace`

| Component | Role |
|-----------|------|
| `DecisionTraceService` | Async append-only persistence, snapshot builders |
| `DecisionTraceRepository` | JPA queries on `decision_trace` |
| `DecisionNarrativeBuilder` | Human-readable narratives |
| `EntryReasoningSnapshot` | Full entry context |
| `ExitReasoningSnapshot` | Adaptive exit context |
| `SuppressionReasoningSnapshot` | Rejection / suppression / queue |
| `ReplacementReasoningSnapshot` | Replacement vs active slot |
| `DecisionTraceConfig` | `decisionTraceExecutor` (non-blocking) |

## Table `decision_trace`

Indexed: `symbol`, `regime`, `market_structure`, `entry_quality`, `lifecycle`, `session_type`, `outcome`, `execution_date`, `decision_type`.

- Scalar columns for query
- `snapshot_json` (full structured payload)
- `narrative` (human story)

## Integration

| Hook | Traces |
|------|--------|
| `LiveTraderAutoExecutionHook` | ENTRY on fill, REJECTION on intelligence block |
| `PortfolioOrchestrationService` | QUEUE, REJECTION, SUPPRESSION, REPLACEMENT per ranked opp |
| `PaperExecutionExitService` | EXIT + refinement with entry/exit snapshots |
| `RegimeReliabilityLearningEngine` | Ingests rejection/exit reasoning patterns |
| `ExecutionRefinementEngine` | Uses entry/exit snapshots (not PnL alone) |

## Dedup

Queue/suppression/rejection/replacement: same symbol+state+reason within **120s** skipped to avoid refresh-loop flood. ENTRY/EXIT always persisted.

## Example query (future)

```sql
SELECT * FROM decision_trace
WHERE persistence >= 70
  AND market_structure LIKE '%CHOP%'
  AND regime LIKE '%SHALLOW_PULLBACK%'
  AND decision_type = 'EXIT'
ORDER BY recorded_at DESC;
```

## No UI changes

Reasoning is server-side only; enables later AI review, filter validation, and autonomous evolution without dashboard expansion.
