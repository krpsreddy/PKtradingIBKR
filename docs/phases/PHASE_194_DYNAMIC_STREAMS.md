# Phase 194 — Dynamic live stream orchestrator

## Problem

IBKR error **101** (max tickers) when the app subscribed to every `subscribeLive` watchlist symbol at connect.

## Solution

**DynamicLiveStreamOrchestrator** allocates `ibkr.max-live-streams` realtime slots by execution importance, not static DB flags.

| Tier | IBKR `reqMktData` | Use |
|------|-------------------|-----|
| **REALTIME** | Yes | Positions, queue, dominance, scanner top-N |
| **SNAPSHOT** | No | Periodic candle/quote refresh (30s) |
| **DORMANT** | No | Historical context only |

## Backend

| Component | Role |
|-----------|------|
| `StreamPriorityEngine` | Scores enabled symbols (position, queue, dominance, scanner, lifecycle) |
| `LiveStreamSlotManager` | Subscribe/unsubscribe within cap; promotion/demotion queues |
| `DynamicLiveStreamOrchestrator` | Reconcile every 5s; bootstrap after historical; priority reconnect |
| `GET /api/live-trader/stream-state` | Mobile + ops visibility |

### Priority rules (high level)

- **Always realtime**: active paper position, QUEUE, REPLACEMENT, dominance ≥ 130, scanner top 8, emerging velocity
- **Snapshot**: secondary watchlist with scan relevance
- **Dormant**: exhausted/failed lifecycle, long idle, no orchestration relevance

### Config (`application-evolution.properties`)

```properties
ibkr.stream.dynamic-enabled=true
ibkr.stream.dominance-realtime-threshold=130
ibkr.stream.max-snapshot-symbols=30
ibkr.stream.reconcile-interval-ms=5000
```

Set `ibkr.stream.dynamic-enabled=false` to restore legacy `subscribeLive` batch behavior.

## Mobile

**Monitor** tab → **STREAM UTILIZATION** panel (`StreamUtilizationPanel`).

## Verify

1. Restart evolution; connect IBKR.
2. `curl http://localhost:8180/api/live-trader/stream-state` — `realtimeUsed` ≤ `realtimeMax`.
3. Logs: `Dynamic live stream bootstrap`, `Stream rotation promoted/demoted`.
4. No error 101 with 100+ enabled symbols (only ≤40 realtime).
