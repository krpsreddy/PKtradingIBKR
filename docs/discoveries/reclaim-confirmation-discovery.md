# Reclaim Confirmation Discovery

**Status:** Validated across Phases 141, 142, 144, 146  
**Confidence:** HIGH (when n ≥ 25)

## Finding

Momentum and breakout setups are **profitable primarily after reclaim confirmation**, not on first impulse extension.

Instant entry at initial breakout frequently captures fakeouts. Waiting for reclaim hold or acceptance confirmation improves expectancy despite missing early expansion.

## Evidence

| Module | Metric |
|--------|--------|
| Phase 142 sequencing | `RECLAIM_HOLD` state precedes best continuation acceptance |
| Phase 141 acceptance confirmation | Confirmed entry expectancy > instant entry |
| Phase 144 wait-vs-act | `WAIT_FOR_ACCEPTANCE` reduces fakeout rate |
| Phase 146 missed expansion | Pullback wait sacrifices ~40% capture but improves survival |

## Execution implication

- Default to `WAIT_FOR_ACCEPTANCE` when narrative not yet stable
- `FULL_EXECUTION` only after reclaim hold + ideal entry location
- Opening impulse entries should probe size, not full size

## Related phases

137 (gate), 142 (sequencing), 143 (live decision), 146 (adaptive entry)

## Safety

Advisory guidance only — does not auto-delay signal generation.
