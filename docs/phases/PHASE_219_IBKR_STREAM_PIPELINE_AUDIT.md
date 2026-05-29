# Phase 219 — IBKR Realtime Stream Pipeline Audit & Stabilization

## Executive summary

Production symptoms (`ibkrConnected=true`, `ibkrStreaming=false`, `realtimeUsed=0`, registry subs > 0, no ticks 60s+, 5m candles frozen, integrity STALE) are **not** evidence that IBKR cannot support the architecture. Root cause is **improper orchestration and ghost subscription state**, compounded by integrity scoring during bootstrap.

| Hypothesis | Verdict |
|------------|---------|
| **A** Orchestration timing (reconcile before `IBKR_READY`) | **Primary** (Phase 216 gate; reinforced here) |
| **C** Subscription timing + ghost ledger on failed subscribe | **Primary** (fixed Phase 219) |
| **G** Integrity false positives (zero verified → STALE during bootstrap) | **Secondary** (90s grace) |
| **D** IBKR pacing / churn | **Monitor** (`pacingViolationCount`, reconcile duration) |
| **B** Reconnect lifecycle | **Contributing** — maps cleared on disconnect; restore gated on ready |
| **E** Thread starvation | **Unlikely** — EReader loop separate from reconcile |
| **F** Candle aggregation failure | **Symptom only** — `onTick()` stops when ticks stop |

**Conclusion:** Do **not** migrate providers yet. Stabilize orchestration, registry, and diagnostics first.

---

## Root-cause findings

### 1. Ghost subscription ledger (critical)

`SubscriptionManagerService.subscribeIfNeeded()` previously registered the symbol in `symbolToTickerId` **before** `reqMktData`. If subscribe failed (`not connected` / `not ready`), `isSubscribed()` returned true and **blocked all retries** — matching:

- `subscriptionCount` > 0
- `realtimeUsed` = 0
- `Cannot subscribe — IBKR not connected` during startup/reconcile
- `CandleAggregatorService.onTick()` never runs

**Fix:** Gate on `isIbkrReady()`, call `subscribeToSymbol()` first, only register on success; `isSubscribed()` uses manager map only; `pruneOrphanRegistryEntries()` on periodic health pass.

### 2. Reconcile before handshake (Phase 216, still relevant)

`reqMktData` before `nextValidId` + market-data farm → silent no ticks. `IbkrReadinessGate` + `bootstrapAfterReady()` address this; Phase 219 removes **read-path reconcile** that re-triggered churn.

### 3. Read API triggering reconcile

`GET /api/live-trader/stream-state` called `reconcileWhenReady()` — mobile/UI polling caused subscribe/unsubscribe churn.

**Fix:** `stream-state` is read-only; reconcile only via `StreamHealthOrchestrator` schedule + explicit bootstrap.

### 4. Integrity STALE during bootstrap

Zero verified streams within seconds of `IBKR_READY` forced STALE while subscriptions were still pacing.

**Fix:** 90s bootstrap grace → DEGRADED with message `Stream bootstrap — awaiting verified ticks`.

### 5. IBKR pacing risk

Bulk promote during reconcile without delay can violate line rate.

**Fix:** 250ms pause after each successful `subscribeIfNeeded` in `LiveStreamSlotManager`.

---

## Reproduction scenarios

1. **Startup race:** Start evolution while TWS still handshaking; watch logs for `Cannot subscribe — IBKR not connected`; before fix: registry count rises, `ticksLast10s=0`; after fix: failed attempts do not stick in registry.
2. **UI poll churn:** Rapid `GET /stream-state` (mobile shell); before fix: promotion/demotion spikes; after fix: reconcile only on 30s scheduler.
3. **Reconnect:** Kill socket; verify `reconnect-history` and `symbolsStreaming` recovers within verify timeout (default 45s) + bootstrap grace.
4. **Ghost recovery:** Inject stale registry (legacy) or failed subscribe; `pruneOrphanRegistryEntries` + verify pass clears and re-subscribes.

---

## Stabilization fixes (this phase)

| Component | Change |
|-----------|--------|
| `SubscriptionManagerService` | Ready gate, subscribe-before-register, orphan prune |
| `IBKRClientService` | `subscribeToSymbol` → boolean, phase/tick/disconnect traces |
| `LiveStreamSlotManager` | 250ms subscribe pacing |
| `DynamicLiveStreamOrchestrator` | Reconcile trace start/end |
| `StreamHealthOrchestrator` | Orphan prune before verify/recover |
| `DataIntegrityEngine` | 90s bootstrap grace |
| `LiveTraderController` | No reconcile on `stream-state` GET |
| `StreamPipelineDiagnostics` | Full trace + snapshot metrics |
| `StreamDiagnosticsController` | Debug endpoints |

---

## Diagnostics endpoints

Base: `http://localhost:8180/api/live-trader`

| Endpoint | Purpose |
|----------|---------|
| `GET /stream-debug` | Snapshot: connected, ready, streaming, subs, ticks/10s, pacing, stalled symbols, `rootCauseHint` |
| `GET /tick-health` | Per-symbol last tick age, verified health, registry flag |
| `GET /candle-health` | Probe symbol bar lag, partial candle, integrity state |
| `GET /reconnect-history` | Reconnect + lifecycle trace rings |

Trace rings (in-memory, last 200): `stream_lifecycle_trace`, `subscription_attempt_trace`, `tick_heartbeat_trace`, `reconnect_trace`, `candle_gap_trace`.

---

## Recovery validation checklist

After `./start-evolution.sh` during RTH:

- [ ] `stream-debug`: `ibkrReady=true`, `symbolsStreaming` > 0, `ticksLast10s` > 0
- [ ] `tick-health`: enabled symbols show `lastTickAgeMs` < 15000 for realtime tier
- [ ] `candle-health`: `candleBuildLagMs` < 300000 (5m bar), `livePartialCandle=true` when ticking
- [ ] Integrity transitions: DEGRADED (bootstrap) → LIVE within ~90s
- [ ] Disconnect TWS briefly: `reconnectCount` increments; streams recover without restart
- [ ] `subscriptionFailed` not climbing while `symbolsSubscribed` flat

---

## Operational recommendations

| Parameter | Recommended |
|-----------|-------------|
| Max realtime symbols | **30–40** (`ibkr.max-live-streams`) |
| Reconcile cadence | **30s** (`ibkr.stream.reconcile-interval-ms`) |
| Subscribe pacing | **250ms** between `reqMktData` (built into slot manager) |
| Verify timeout | **45s** — unsubscribe + retry if no tick |
| Market data type | **1** (live) when entitled; else 3 + accept DELAYED integrity |
| Mobile/UI | Poll `stream-state` ≤ every 30s; use `stream-debug` for ops |

Watch `pacingViolationCount` and `lastReconcileDurationMs` > 5000 → reduce symbol count or increase reconcile interval.

---

## Is IBKR sufficient?

**Yes**, for current single-account evolution profile at ≤40 concurrent realtime lines, provided:

1. Subscriptions only after `IBKR_READY`
2. No ghost registry blocking retries
3. No reconcile triggered by read APIs
4. Pacing between bulk subscribes

Fallback providers are **not required** to prove stability; add only if pacing violations persist at reduced symbol counts or live entitlement is unavailable.

---

## Safe symbol count & reconcile cadence

- **Safe realtime:** 30–40 symbols with 250ms pacing ≈ 8–10s full bootstrap — within 90s grace.
- **Reconcile:** 30s fixed delay; avoid <15s (churn risk).
- **Auto-recover:** max 8 symbols per cycle (existing cap).

---

## Files touched

- `com.tradingbot.ibkr.SubscriptionManagerService`
- `com.tradingbot.ibkr.IBKRClientService`
- `com.tradingbot.ibkr.stream.*`
- `com.tradingbot.dataintegrity.DataIntegrityEngine`
- `com.tradingbot.ibkr.diagnostics.*`
- `com.tradingbot.livetrader.LiveTraderController`
