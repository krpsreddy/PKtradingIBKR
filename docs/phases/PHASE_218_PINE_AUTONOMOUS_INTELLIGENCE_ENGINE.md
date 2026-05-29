# Phase 218 — Pine Autonomous Intelligence Engine (TV → Backend Bridge)

## Script

`scripts/tradingview/PK_Autonomous_Intelligence_Engine.pine`

- **Type:** Indicator (`PK Intel`)
- **Purpose:** Realtime structural intelligence engine — not EMA/RSI buy-sell
- **Output:** JSON webhook payloads via `alert()` + optional `alertcondition` hooks

## Intelligence layers

| Layer | Outputs |
|-------|---------|
| Bullish | conviction, dominance, persistence, continuation quality, acceleration, trend maturity, lifecycle |
| Bearish | bearishBias, reclaimFailure, rejectionPersistence, breakdownAcceleration, distribution, squeezeRisk, putGrade |
| Conflict | NONE / LOW / MODERATE / HIGH |
| Deterioration | FLATTENING, PERSISTENCE_DECAY, VWAP_FAILURE, EXHAUSTION_RISK, COLLAPSE_RISK |
| PM (9:00–9:30) | PM_STRONG, PM_FAILED_GAP, PM_DISTRIBUTION, PM_NEUTRAL |
| Execution quality | ELITE / HIGH / MEDIUM / WEAK / POOR |

## Discovery thresholds (inputs)

Defaults mirror `/api/discovery/export/pine/*`:

- Bullish RVOL ≥ 2.4, persistence ≥ 70, acceleration ≥ 65
- Bearish reclaim ≥ 58, rejection ≥ 55, breakdown ≥ 52, downside RVOL ≥ 1.35

Tune from latest discovery export JSON.

## Webhook setup (TradingView)

1. Add indicator to 5m chart (watchlist scanning).
2. Create alert: **PK Autonomous Intelligence Engine** → condition **WEBHOOK_PUSH** (or any edge alert).
3. **Notifications:** Webhook URL  
   `http://<host>:8180/api/tradingview/webhook`
4. Enable **Open-ended alert** if you want continuous pushes.
5. Message: leave default when using `alert()` in script (JSON body).  
   Or duplicate JSON in alert message with placeholders `{{plot("dominance")}}` etc.
6. Optional header: `X-TV-Token: <tradingview.webhook-secret>`

## Example payload

```json
{
  "symbol": "PLTR",
  "direction": "BULLISH",
  "dominance": 152,
  "conviction": 81,
  "persistence": 74,
  "rvol": 3.1,
  "lifecycle": "CONFIRMED",
  "regime": "COMPRESSION_BREAKOUT",
  "executionQuality": "HIGH",
  "bearishBias": 12,
  "putGrade": "NONE",
  "deterioration": "NONE",
  "conflictLevel": "LOW",
  "pmState": "PM_STRONG",
  "timestamp": 1716912345678
}
```

## Alert throttling (in-script)

Pushes only on:

- Lifecycle transition
- PUT grade change
- Conflict escalation
- Deterioration change
- Dominance change ≥ threshold
- Bullish continuation / PUT A+ / LONG BLOCKED / COLLAPSING / PM edges

Uses `alert.freq_once_per_bar_close` to limit spam.

## Pine limitations

- Pine cannot HTTP POST directly; **TradingView alert webhook** delivers the payload.
- `alert()` message size is limited (~4k); keep JSON compact.
- Multi-symbol watchlist requires **one alert per chart** or screener integration (TV limitation).
- Timestamps use bar `time` (ms); backend accepts epoch ms.
- No order execution from this script — intelligence feed only.

## Backend integration

- Phase 217: `POST /api/tradingview/webhook`, `GET /api/tradingview/feed`
- Mobile **TV** tab displays ranked feed (secondary to IBKR scanner)

## Related scripts

| Script | Role |
|--------|------|
| `PK_Autonomous_Regime_Engine.pine` | Chart overlay + manual alerts |
| `PK_Autonomous_Strategy_Planner.pine` | Backtest / strategy orders |
| `PK_Autonomous_Intelligence_Engine.pine` | **Webhook intelligence bridge** |
