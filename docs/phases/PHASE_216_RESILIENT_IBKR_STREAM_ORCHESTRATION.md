# Phase 216 — Resilient IBKR Stream Orchestration + Data Integrity Recovery

## Problem

IBKR socket connected while `ibkrStreaming=false`, registry showed 40 subscriptions but `realtimeUsed=0` (ghost subs). `reconcile()` ran before `nextValidId`/farm ready → `reqMktData` failed silently → no ticks → frozen 5m candles → integrity `STALE`.

## Solution

### Connection phases (`IbkrConnectionPhase`)

`DISCONNECTED` → `SOCKET_CONNECTED` → `API_READY` → `IBKR_READY` → `STREAM_ACTIVE` → `DATA_HEALTHY`

`IBKR_READY` requires: socket + `nextValidId` + market-data farm OK + `managedAccounts` (8s grace).

### Block early subscriptions

`SubscriptionManagerService.subscribeIfNeeded()` and `IBKRClientService.subscribeToSymbol()` return until `isIbkrReady()`.

Stream orchestration starts only from `StreamHealthOrchestrator` on `IBKR_READY` (`bootstrapAfterReady()`).

### Tick-verified registry (`VerifiedStreamRegistry`)

- `realtimeUsed` / ops `verifiedActiveStreams` count only symbols with received ticks.
- Pending subs verified within `ibkr.stream.verify-timeout-seconds` (default 10); failures → unsubscribe + ghost cleanup.
- Per-symbol health: `LIVE` / `DEGRADED` / `STALE` / `DEAD` from last tick age.

### Self-healing (`StreamHealthOrchestrator`)

Every `ibkr.stream.reconcile-interval-ms` (default 30s):

- Verify pending subscriptions
- Auto-recover stale/dead streams (unsubscribe, 1s, resubscribe) when `ibkr.stream.auto-recover=true`
- Reconcile desired vs active slots
- Promote `DATA_HEALTHY` when verified ticks > 0

### Scanner decoupling

`StreamPriorityEngine` gives `subscribeLive` symbols a baseline score so realtime slots do not depend on scanner ON.

### Integrity

`DataIntegrityEngine` distinguishes handshake incomplete (`DEGRADED`) vs no verified ticks (`STALE`) before tick staleness checks.

Reconnect gap backfill remains via `ReconnectRecoveryCoordinator` triggered from `bootstrapAfterReady()`.

## Config (`application-evolution.properties`)

```properties
ibkr.stream.reconcile-interval-ms=30000
ibkr.stream.verify-timeout-seconds=10
ibkr.stream.stale-seconds=60
ibkr.stream.dead-seconds=120
ibkr.stream.auto-recover=true
```

## APIs

- `GET /api/live-trader/stream-state` — `verifiedActiveStreams`, `registrySubscriptions`, `staleStreams`, `deadStreams`, `streamHealthScore`, `ibkrPhase`
- `GET /api/live-trader/ops` — same metrics + tick age for mobile Monitor

## Healthy state

```
ibkrConnected=true
ibkrReady=true
ibkrStreaming=true
verifiedActiveStreams > 0
registrySubscriptions ≈ verified (no large ghost gap)
dataIntegrity.state=LIVE
```

5m bars advance on tick; no manual restart required for stream recovery.
