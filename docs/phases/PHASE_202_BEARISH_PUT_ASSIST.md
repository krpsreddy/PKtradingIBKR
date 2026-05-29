# Phase 202 — Bearish PUT assist mode (no auto short)

Discretionary bearish execution assistance using existing execution intelligence. **No** autonomous short selling, stock shorts, or PUT orders from the bot.

## Mode

| Mode | Behavior |
|------|----------|
| `LONG_ONLY` | Default — no PUT assist |
| `LONG_PLUS_PUT_ASSIST` | Advisory PUT assist on ranked opportunities |
| `FULL_SHORT_EXECUTION` | Reserved — not implemented |

Enable at runtime:

```http
PUT /api/live-trader/runtime/bearish-assist?mode=LONG_PLUS_PUT_ASSIST
```

Or in `application-evolution.properties`:

```properties
live-trader.bearish-assist-mode=LONG_PLUS_PUT_ASSIST
```

## Package `bearishassist`

- `BearishBiasEngine` — 0–100 bearish bias (dedicated bearish logic, not inverted bullish)
- `BearishLifecycleEngine` — states: `VWAP_REJECTION`, `FAILED_RECLAIM`, `BREAKDOWN_CONFIRMATION`, etc.
- `BreakdownContinuationEngine` — `LOW` / `MEDIUM` / `HIGH` breakdown probability
- `PutAssistEvaluator` — gates assist (blocks chop bounces, trend-day bull, low RVOL)
- `PutAssistNarrativeBuilder` — human-readable story
- `BearishAssistService` — mode + evaluation facade

## API fields

`RankedOpportunityDto.putAssist`:

- `active`, `bearishBias`, `bearishState`, `breakdownProbability`, `confidence`
- `reasons`, `narrative`, `badgeLabel` (`PUT ASSIST` when active)

## Persistence

- `decision_trace` — `PUT_ASSIST` rows via `BearishReasoningSnapshot`
- `bearish_assist_telemetry` — trigger log for follow-through analysis

## Mobile

Minimal badge on opportunity row when `putAssist.active`.

## Safety

Auto paper long execution unchanged. PUT assist never places orders.
