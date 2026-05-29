# Phase 217 — TradingView Intelligence Bridge

## Architecture

```
TradingView Pine alerts → POST /api/tradingview/webhook
  → ingestion + throttle → TradingViewSignalStore
  → TradingViewRankingEngine → GET /api/tradingview/feed
  → PK Live Trader **TV** tab (secondary intelligence)
```

IBKR live scanner, paper execution, and orchestration are unchanged. TV is **intelligence only** — no execution bypass.

## Backend (`com.tradingbot.tradingview`)

| Area | Components |
|------|------------|
| `webhook/` | `TradingViewWebhookController` — `POST /api/tradingview/webhook` |
| `ingestion/` | `TradingViewWebhookIngestionService`, `TradingViewAlertThrottler` |
| `state/` | `TradingViewSignalStore` (15m stale expiry) |
| `ranking/` | `TradingViewRankingEngine` |
| `bridge/` | `TradingViewFeedController`, `DiscoveryPineExportBridge` |
| `dto/` | `TradingViewSignalDto`, `TradingViewFeedDto`, payloads |

## Discovery → Pine export

- `GET /api/discovery/export/pine/bullish?days=60`
- `GET /api/discovery/export/pine/bearish?days=60`
- `GET /api/discovery/export/pine/put-assist?days=60`

Returns thresholds, regime families, continuation gates, bearish structures, lifecycle intelligence from historical bulk discovery.

## Webhook payload example

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
  "putGrade": "NONE",
  "bearishBias": 12,
  "executionQuality": "HIGH",
  "timestamp": 1234567890000
}
```

Optional header: `X-TV-Token` when `tradingview.webhook-secret` is set.

## Config (`application-evolution.properties`)

```properties
tradingview.stale-minutes=15
tradingview.throttle-seconds=60
tradingview.max-stored-signals=500
tradingview.top-list-size=12
```

## Mobile

New **TV** tab (not merged with Scanner). Sections: Top Bullish, Top Bearish, PUT Assist, High Conflict, Collapsing. Cards show **TV** chip; IBKR rows show **IBKR** chip.

## TradingView alert URL

`http://<host>:8180/api/tradingview/webhook`

Pine alert message must send JSON body matching the payload format (use alert() JSON or webhook integration).

## Future (not in this phase)

Hybrid confidence (IBKR + TV), multi-watchlist, hybrid scoring.
