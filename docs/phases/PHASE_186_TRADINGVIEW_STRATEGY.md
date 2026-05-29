# Phase 186 — TradingView Entry/Exit Strategy Planner

## Scripts

| File | Role |
|------|------|
| `scripts/tradingview/PK_Autonomous_Regime_Engine.pine` | Visual **indicator** (unchanged) |
| `scripts/tradingview/PK_Autonomous_Strategy_Planner.pine` | **strategy()** + backtest + execution layer |

## Architecture

```
┌─────────────────────────────────────────┐
│  Autonomous Regime Engine (preserved)   │
│  regimes · dominance · conviction ·     │
│  persistence · lifecycle · zones        │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  Execution Planner Layer (Phase 186)    │
│  entry types · exit types · trade FSM   │
│  risk stops · targets · strategy.*    │
└─────────────────────────────────────────┘
```

## Strategy modes

1. **SCALP** — tighter stops/targets, higher conviction bar, early allowed
2. **INTRADAY_CONTINUATION** — default; confirmed primary
3. **SWING_CONTINUATION** — wider ATR stop/target multipliers
4. **AGGRESSIVE_EARLY_ENTRY** — early + confirmed
5. **CONFIRMED_ONLY** — lifecycle CONFIRMED entries only

## Entry types

| Type | Conditions |
|------|------------|
| Early | DEVELOPING lifecycle, velocity ↑, persistence ↑, compression/VWAP reclaim |
| Confirmed | CONFIRMED lifecycle, conviction/persistence/dominance thresholds, low exhaustion |
| Second leg | Compression breakout add-on (pyramiding=1) |
| VWAP acceptance | Regime VWAP_ACCEPTANCE + institutional pressure |

## Exit types

| Type | Action |
|------|--------|
| Reduce risk | Partial close (`strategy.close` %) |
| Exit warning | Partial close |
| Exit critical | Full close (FAILED lifecycle / regime) |
| Failed continuation | Full close |
| Persistence / trail hold | State only; bracket manages exit |

## Trade state machine

`WAITING` → `DEVELOPING` → `ENTERED` → `CONFIRMING` → `CONFIRMED` → `SECOND_LEG` / `HOLDING` → `REDUCE` → `EXIT_WARNING` → `EXITED` / `FAILED`

## Risk management

- **FIXED_PCT** — percent stop from entry
- **STRUCTURE** — VWAP / swing low structure stop
- **ATR** — ATR × mult
- **TRAILING_ATR** — trail_points on `strategy.exit`
- **PERSISTENCE_TRAIL** — stop ratchets with persistence score

## Target engine

- **FIXED_RR** — risk × R multiple
- **PERSISTENCE_CONT** — ATR scaled by persistence
- **ADAPTIVE** — blend RR + expansion probability
- **SECOND_LEG_EXT** — extended compression target
- **INST_PERSIST** — institutional participation scaled

## Strategy Tester

Uses `strategy.entry`, `strategy.exit`, `strategy.close` with commission/slippage inputs on `strategy()`.

Metrics: win rate, profit factor, max drawdown, avg trade — standard TV Strategy Tester.

## Timeframes

Optimized for **5m**; logic uses session windows and bar-based persistence (works on 1m / 15m / 1h).

## Future extension points

- Bearish / short regimes (mirror FSM with `enableShorts`)
- HTF regime filter (`request.security`)
- Mean-reversion and reversal strategy modes
- Regime-specific position sizing tables

## Visual hierarchy (chart cleanup)

Both Pine scripts use **glass overlays** with full autonomous terminology preserved:

- **DOMINANT NOW**, full `regimeName` (e.g. `SHALLOW_PULLBACK_CONTINUATION`, `COMPRESSION_BREAKOUT`)
- **EARLY ENTRY**, **CONFIRMED ENTRY**, **SECOND LEG**, **PERSISTENCE HOLD**, **REDUCE RISK**, **EXIT WARNING**, **FAILED_EXPANSION**
- **LONG ZONE** / **RISK ZONE** translucent fills (88) + readable borders
- Historical label fade + ATR stagger (collision reduction only)
- `mobileLabels` = spacing/size only — never shortens regime language

## Usage

1. TradingView → Pine Editor → paste `PK_Autonomous_Strategy_Planner.pine`
2. Add to chart (5m recommended)
3. Open **Strategy Tester** tab
4. Tune filters under *Intelligence Filters* and *Strategy Mode*

Keep indicator script on a second pane if you want labels-only view without backtest orders.
