# TradingView — PK Autonomous Scripts

## Scripts

| Script | Type in TradingView | Purpose |
|--------|---------------------|---------|
| `PK_Autonomous_Regime_Engine.pine` | **Indicator** | Regime labels, zones, dashboard, signal markers |
| `PK_Autonomous_Strategy_Planner.pine` | **Strategy** | Same intelligence + `strategy.entry` / backtest |
| `PK_Autonomous_Intelligence_Engine.pine` | **Indicator** | Phase 218 — webhook JSON → backend (`PK Intel`) |

The **Regime Engine alone** does not run the Strategy Tester or place backtest trades.  
Add the **Strategy Planner** as a second script on the same chart.

When both scripts are loaded, disable **Entry / exit event tags** on the Regime Engine if you want entry/exit tags only from the Strategy Planner (avoids duplicate CONFIRMED ENTRY labels).

## Regime Engine → Strategy Planner (1:1 sync)

Your **Regime Engine** indicator defines when signals fire (`earlyEntry`, `confirmedEntry`, `secondLeg`, `reduceRisk`, `exitWarning`).

The **Strategy Planner** runs the **same logic** when **1:1 Regime Engine signals** is ON (default):

| Regime Engine label | Strategy action |
|---------------------|-----------------|
| EARLY ENTRY | `strategy.entry` (smaller size %) |
| CONFIRMED ENTRY | `strategy.entry` (full size %) |
| SECOND LEG | optional add (`Allow second-leg add`) |
| REDUCE RISK | partial close |
| EXIT WARNING | partial close |
| FAILED / EXIT CRITICAL | full close + bracket stop/target |

Turn **1:1 sync OFF** to use filtered mode (extra conviction, RVOL, dominance gates + strategy modes).

## Strategy Planner — one trade at a time

- **Long/short lifecycle locks** block same-direction re-entry while `strategy.position_size` is non-zero.
- Locks reset on **full flat** (stop, target, or exit) — new setups later the same day are allowed.
- **Second-leg add** is off by default; when enabled, only **one** add per trade (`secondLegUsed`).
- Entry labels/alerts fire on **edge only** (`entrySignalEdge`), not on every continuation bar.

## Setup (5m chart recommended)

1. Pine Editor → paste **Regime Engine** → Save → **Add to chart** (indicator).
2. Pine Editor → new script → paste **Strategy Planner** → Save → **Add to chart** (strategy).
3. In **Settings → Visuals** on each script:
   - **Live regime tag (current only)** — ON — single high-contrast tag on the last bar (regime + lifecycle; DOMINANT NOW when active)
   - **Entry / exit event tags** — ON — one compact tag per bar (CONFIRMED ENTRY, EARLY ENTRY, EXIT CRITICAL, etc.)
   - **Entry / exit signal markers** — ON
   - **Zone fill transparency** — default `88` (candles visible; borders stay crisp)
   - **Repeat label cooldown** — default `6` bars (stops stacked VWAP ACCEPTANCE clutter)
   - **Zones in right margin** — OFF by default (zones on price); turn ON on mobile if overlap is heavy

## Chart-first visuals (lightweight)

Priority: **candles** → subtle zones → small assistive tags → live regime tag.

- Event tags: **small** labels, **~26% opaque** dark backing, accent text, `yloc` above/below bar (avoids candle overlap).
- Max **4** recent tags, faded over time; one tag per bar cooldown unchanged.
- Zones/lifecycle fills stay **very light** (default transparency **94**).
- Panel: simple two-column layout; **FAILED** lifecycle in **amber** (`#ffb86b`).
- Zoom-out: tags bump from `small` → `normal` only when many bars visible.

## If labels / signals look missing

- **FAILED / low conviction** bars often skip DOMINANT NOW (dominance &lt; threshold). The **live regime tag** on the last bar still shows regime, lifecycle, and conviction.
- **Strategy Planner** must be added separately — it appears in the **Strategy Tester** tab and draws trade arrows.
- Re-paste the latest `.pine` from this repo after updates.

## Chart shows `CONF +10` or `PK_EXIT` instead of terminology

Those are **TradingView strategy order badges** from short `comment=` strings. The latest Strategy Planner uses full comments (`CONFIRMED ENTRY`, `REDUCE RISK`, `STOP + TARGET`) plus separate **Pine labels** on each event.

Optional: Chart settings → your strategy → uncheck **Orders and positions** if you only want Pine labels (not TV trade markers).

## Files

- `PK_Autonomous_Regime_Engine.pine` — overlay indicator (`PK Regime`)
- `PK_Autonomous_Strategy_Planner.pine` — strategy (`PK Strat`)

Docs: `docs/phases/PHASE_186_TRADINGVIEW_STRATEGY.md`, `docs/phases/PHASE_214_PINE_BEARISH_INTELLIGENCE.md`

## Phase 214 — Bearish intelligence (Strategy Planner)

**Phase 214 bearish intelligence** is on both **Regime Engine** (indicator) and **Strategy Planner** (strategy). Enable **Bearish Intelligence (Phase 214)** in script settings for failed reclaim, PUT grades, long suppression, conflict, and sparse tags. Strategy Planner adds backtest telemetry; Regime Engine is for chart replay without orders. Does not enable automatic short orders by default (`Enable short entries` remains off).

## Phase 217 — Backend webhook bridge

Push dominant setups to PK Live Trader (intelligence only — no auto-execution):

1. Evolution backend: `POST http://<host>:8180/api/tradingview/webhook`
2. JSON body: `symbol`, `direction`, `dominance`, `conviction`, `persistence`, `rvol`, `lifecycle`, `regime`, `putGrade`, `bearishBias`, `executionQuality`, `timestamp`
3. Mobile app: **TV** tab shows ranked bullish/bearish/PUT assist feeds
4. Discovery thresholds for Pine: `GET /api/discovery/export/pine/bullish` (and `/bearish`, `/put-assist`)

Optional: set `tradingview.webhook-secret` and send header `X-TV-Token`.

## Phase 218 — PK Autonomous Intelligence Engine

Use **`PK_Autonomous_Intelligence_Engine.pine`** on each watchlist chart (5m) when you want TV to push ranked intelligence to the backend.

1. Load indicator **PK Autonomous Intelligence Engine** (`PK Intel`).
2. Tune **Discovery Thresholds** from `GET /api/discovery/export/pine/bullish` (or bearish).
3. Enable **Push JSON via alert()** under **Webhook Bridge**.
4. Create alert → **WEBHOOK_PUSH** (or PUT A+ / BULLISH CONTINUATION).
5. Webhook URL: `http://<host>:8180/api/tradingview/webhook`
6. View feed on PK Live Trader mobile **TV** tab.

Full setup: `docs/phases/PHASE_218_PINE_AUTONOMOUS_INTELLIGENCE_ENGINE.md`
