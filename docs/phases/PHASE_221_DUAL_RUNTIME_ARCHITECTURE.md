# Phase 221 — Dual Runtime Architecture (Paper + Live)

## Overview

Two isolated JVM backends on one machine:

| Runtime | Port | IB Gateway | Client ID | Market data | Execution |
|---------|------|------------|-----------|-------------|-----------|
| **PAPER** | 8180 | 4002 | 101 | Delayed (3) | AUTO_PAPER |
| **LIVE** | 8080 | 4001 | 201 | Live (1) | MANUAL_ASSIST |

## Spring profiles

- `paper` → `application-paper.properties`
- `live` → `application-live.properties`

Legacy `evolution` profile remains; prefer `paper` for new runs.

## Start scripts

```bash
./start-paper.sh    # logs/paper-runtime.log
./start-live.sh     # logs/live-runtime.log
./start-all.sh      # both
```

## API

`GET /api/runtime/profile`

Health endpoints include runtime labels:

- `/api/live-trader/stream-debug` — `runtime`, `integrityMode`
- `/api/live-trader/execution-integrity`
- `/api/live-trader/tick-health`, `/candle-health`

## Safety

`RuntimeExecutionSafetyGuard` blocks on LIVE runtime:

- `auto-paper`
- `AUTO_PAPER` / automated entry modes
- `live-execution-enabled`

## Mobile (Flutter)

- **PAPER / LIVE** selector in app bar
- Runtime banner (orange/blue paper, red live)
- Android default → PAPER `:8180`
- iOS default → LIVE `:8080`

Override host: `flutter run --dart-define=PK_HOST=192.168.x.x`

## DB

`paper_execution_records.runtime_profile` tags rows (`PAPER` / `LIVE`). Shared DB for now; separate DBs prepared for future.

## Verification

```bash
curl -s http://localhost:8180/api/runtime/profile | jq .
curl -s http://localhost:8080/api/runtime/profile | jq .
```

Startup log:

```
[RUNTIME]
profile=PAPER
port=8180
...
```
