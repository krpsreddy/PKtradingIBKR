# Phase 167 — Real-Time Autonomous Execution Engine

## Summary

Transition from candle-close signal platform to **continuous autonomous execution intelligence** via multi-speed staged scanning.

## Architecture

```
1s Nano Anomaly Scan
  → 5–15s Micro Persistence Validation
    → Structural Regime Validation
      → Autonomous Execution Scorer
```

Heavy analytics (discovery, robustness, replay clustering) remain offline. Only incremental micro-evaluation runs continuously.

## Backend

### Strategy Memory Registry
- `src/main/java/com/tradingbot/services/strategymemory/`
- JSON definitions: `src/main/resources/strategies/*.json`
- API: `GET /api/strategy-memory`, `PATCH /api/strategy-memory/{id}/active`

### Real-Time Execution Engine
- `src/main/java/com/tradingbot/intelligence/execution/realtime/`
- `NanoScannerScheduler` — 1 second loop
- API: `GET /api/execution/feed`, `GET /api/execution/feed/{symbol}`

### Execution Maturity States
`DEVELOPING` → `CONFIRMING` → `CONFIRMED` → `EXTENDED` / `EXHAUSTING` / `FAILED`

### Conviction Velocity
Ranking uses `conviction + max(0, convictionVelocity) × 1.5` so rising symbols outrank static high conviction.

## Frontend

- `services/real-time-execution/` — poll-based feed service (1.5s, websocket-ready)
- `components/live-execution-feed/` — sidebar + Edge Lab feed UI
- `components/strategy-memory-panel/` — Strategy Memory tab

### Sidebar
Static regime sections replaced with **Live Autonomous Execution Feed**.

### Edge Lab Tabs
Added: **Execution Feed**, **Strategy Memory**

## Execution Modes
- **EARLY** — pre-confirmation, developing anomalies
- **CONFIRMED** — structural validation passed

## Verification

```bash
mvn compile -DskipTests
cd frontend && npm run build
curl http://localhost:8080/api/execution/feed
curl http://localhost:8080/api/strategy-memory
```

Restart Spring Boot after backend changes to load nano scheduler + new APIs.
