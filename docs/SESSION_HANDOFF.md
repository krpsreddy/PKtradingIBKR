# Session Handoff — PKtradingIBKR

**Date:** 2026-05-28  
**Focus:** IBKR stream stabilization, dual runtime (Phase 221), ops fixes

**Full old-laptop install:** [Windows](OLD_LAPTOP_SETUP_GUIDE_WINDOWS.md) · [macOS](OLD_LAPTOP_SETUP_GUIDE.md)

---

## Executive summary

1. **IBKR streaming** — Root cause was **market-data entitlement** (error 10168), not broken orchestration. Fixed with `ibkr.market-data-type=3` + TWS “Enable delayed market data”. Secondary fixes: ghost subscription ledger, `clearAll()` without `cancelMktData`, ticker ID leak, reconcile-on-GET removed.
2. **Phase 221** — **Paper** (8180 / Gateway 4002 / client 101) and **Live** (8080 / Gateway 4001 / client 201) profiles, start scripts, mobile PAPER/LIVE selector, hard LIVE safety guard.
3. **DB** — Password in gitignored `application-local.properties`.
4. **Mobile** — `opportunity_row.dart` `_chip` color arg fixed for iOS build.

---

## How to run (recommended)

### Dual runtime (Phase 221)

```bash
./start-paper.sh    # Android / auto paper — logs/paper-runtime.log
./start-live.sh     # iPhone / manual assist — logs/live-runtime.log
./start-all.sh      # both
```

Verify:

```bash
curl -s http://localhost:8180/api/runtime/profile | jq .
curl -s http://localhost:8080/api/runtime/profile | jq .
curl -s http://localhost:8180/api/live-trader/stream-debug | jq .
```

### Legacy single backend

```bash
./start-evolution.sh   # profile=evolution, port 8180
```

Or manual:

```bash
export SPRING_PROFILES_ACTIVE=paper   # or live
mvn -q compile spring-boot:run
```

### TWS / Gateway prerequisites

| Runtime | Gateway port | Market data |
|---------|--------------|-------------|
| Paper | **4002** | Type **3** (delayed) — enable delayed in TWS API settings |
| Live | **4001** | Type **1** (live) — requires live API subscriptions |

### Mobile

```bash
cd pk-live-trader-mobile
flutter run   # Android → PAPER :8180 default; iOS → LIVE :8080
```

Override host: `--dart-define=PK_HOST=192.168.x.x`

---

## Configuration reference

| File | Purpose |
|------|---------|
| `application-paper.properties` | PAPER runtime (8180, 4002, delayed, AUTO_PAPER) |
| `application-live.properties` | LIVE runtime (8080, 4001, live, MANUAL_ASSIST) |
| `application-evolution.properties` | Legacy evolution (still works) |
| `application-local.properties` | **Gitignored** — DB password `Kpr1412@postgres` |

DB defaults in `application.properties`:

- Host: `localhost:5432`
- DB: `trading_signals`
- User: `${USER:pk}` (set `spring.datasource.username=postgres` in local if needed)

---

## IBKR stream diagnostics (Phase 219)

| Endpoint | Use |
|----------|-----|
| `GET /api/live-trader/stream-debug` | Connected, streaming, ticks, stalled symbols |
| `GET /api/live-trader/tick-health` | Per-symbol tick age |
| `GET /api/live-trader/candle-health` | Bar lag, partial candle |
| `GET /api/live-trader/reconnect-history` | Reconnect + lifecycle traces |
| `GET /api/live-trader/execution-integrity` | Runtime + integrity snapshot |

**Healthy paper stream (delayed):** `ibkrStreaming=true`, `symbolsStreaming` ~39/40, `ticksLast10s` > 0, `marketDataEntitlementErrors=0`.

**Logs (errors only):**

```bash
grep ' ERROR ' logs/paper-runtime.log
# or Cursor terminal file under terminals/*.txt
```

---

## Key code changes (by area)

### Stream / IBKR (`com.tradingbot.ibkr.*`)

- `SubscriptionManagerService` — subscribe after ready; no ghost registry; `clearAll()` cancels MktData; reset ticker IDs
- `StreamHealthOrchestrator` — orphan prune; periodic reconcile only
- `LiveTraderController` — `stream-state` read-only (no reconcile on GET)
- `DataIntegrityEngine` — 90s bootstrap grace after `IBKR_READY`
- `IBKRWrapper` — handle 10168; `IBKRClientService` — BID/ASK ticks, phase tracing
- `StreamPipelineDiagnostics` + `StreamDiagnosticsController`

### Candles

- `CandleWriteService` — `INSERT ... ON CONFLICT DO NOTHING` (fixes duplicate key `uk1ngqylslccfx7rikw5cnld5tt`)
- Stops Hibernate `SqlExceptionHelper` ERROR spam when historical + live both persist same 5m bar

### Dual runtime (`com.tradingbot.runtime.*`)

- `RuntimeProfileService`, `RuntimeExecutionSafetyGuard`, `RuntimeBootstrap`
- `GET /api/runtime/profile`
- `PaperExecutionRecord.runtimeProfile` column (PAPER/LIVE tag)

### Mobile

- `RuntimeSelector`, `RuntimeBanner`, `runtime_profile_state.dart`
- `opportunity_row.dart` — `_chip(label, [colorOverride])`

---

## Phase docs

| Phase | Doc |
|-------|-----|
| 219 | `docs/phases/PHASE_219_IBKR_STREAM_PIPELINE_AUDIT.md` |
| 221 | `docs/phases/PHASE_221_DUAL_RUNTIME_ARCHITECTURE.md` |
| 218 | `docs/phases/PHASE_218_PINE_AUTONOMOUS_INTELLIGENCE_ENGINE.md` |

---

## Root-cause cheat sheet

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `ibkrConnected=true`, `symbolsStreaming=0`, 10168 in logs | No live/delayed entitlement | Type 3 + enable delayed in TWS |
| `subscriptionCount` high, no ticks | Ghost registry (pre-fix) or entitlement | Restart with current code + type 3 |
| `Can't find EId tickerId:4xx` | `clearAll()` without cancel + ticker ID leak | Fixed in `SubscriptionManagerService` |
| Duplicate key on `candles` | Historical + live same bar | `CandleWriteService` |
| `stalledSymbols` for dormant names | Diagnostic false positive | Fixed: only active subs counted |
| LIVE auto paper | Misconfig | `RuntimeExecutionSafetyGuard` blocks |

---

## Open / follow-up

- [ ] Confirm Postgres user (`pk` vs `postgres`) matches `application-local.properties`
- [ ] Run `./start-all.sh` and validate both profiles during RTH
- [ ] iOS device: rebuild after `opportunity_row` fix; confirm LIVE runtime connects to `:8080`
- [ ] Live runtime: confirm live market data subscriptions if using type 1
- [ ] Optional: migrate fully off `evolution` profile to `paper` in docs/scripts
- [ ] Optional: separate DBs `tradingbot_paper` / `tradingbot_live` (prepared via `runtime_profile` column only)

---

## Security note

- DB password is in **`application-local.properties`** (gitignored). Do not commit that file.
- Rotate password if this handoff is shared externally.

---

## Quick health checklist

```bash
# Paper
curl -s localhost:8180/api/runtime/profile
curl -s localhost:8180/api/live-trader/stream-debug | jq '{streaming:.ibkrStreaming,verified:.symbolsStreaming,ticks:.ticksLast10s}'

# Live
curl -s localhost:8080/api/runtime/profile
curl -s localhost:8080/api/live-trader/stream-debug | jq '{streaming:.ibkrStreaming,verified:.symbolsStreaming,ticks:.ticksLast10s}'
```

Expected paper: `runtime=PAPER`, `executionMode=AUTO_PAPER`, streaming healthy with delayed data.

Expected live: `runtime=LIVE`, `executionMode=MANUAL_ASSIST`, `autoPaperEnabled=false`.
