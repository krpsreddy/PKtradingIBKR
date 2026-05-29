# Phase 191 — Streaming Live Runtime (No Continuous Hydration)

PK Live Trader uses **rolling realtime execution intelligence**, not per-tick research hydration.

## Removed from live path

- `LiveScannerService.refresh()` → `promoteHigh()` loop (was every 2s for top-3 symbols)
- `activateRuntime()` → `queueMedium()` on every symbol activation

## Added

| Component | Role |
|-----------|------|
| `RuntimeBootstrapCache` | Per-symbol bootstrap state + session id |
| `RuntimeBootstrapService` | One-time bootstrap, session reset, reconnect recovery, optional 45m refresh |
| `LiveRuntimeProperties` | `live-runtime.*` in `application-evolution.properties` |

## Config (evolution)

```properties
live-runtime.research-hydration-enabled=false
live-runtime.bootstrap-enabled=true
live-runtime.bootstrap-refresh-minutes=45
```

## Research hydration

`BackgroundHydrationOrchestrator` remains for Edge Lab / replay when `live-runtime.research-hydration-enabled=true` (LOW priority only, trace logs).

## IBKR reconnect

`BrokerConnectionManager.onReady` → `RuntimeBootstrapService.onReconnectRecovery()` (single pass).
