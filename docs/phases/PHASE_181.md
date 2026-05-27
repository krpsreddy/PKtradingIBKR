# Phase 181 — Autonomous Paper Execution Research Infrastructure

## Branch

`phase-181-paper-execution-research` (evolution work; `main` / stable behavior unchanged).

## Two runnable environments

| | Stable | Evolution |
|---|--------|-----------|
| Script | `./start-stable.sh` | `./start-evolution.sh` |
| Backend | `http://localhost:8080` | `http://localhost:8180` |
| Frontend | `http://localhost:4200` | `http://localhost:4300` |
| Spring profile | default | `evolution` |
| Paper research | OFF | ON (`paper-execution.research.enabled=true`) |
| IBKR default port | 7496 (live) | 7497 (paper) |
| Frontend storage | `pk-stable-*` | `pk-evolution-*` |

## Execution modes (canonical)

```
OFF
PAPER_RESEARCH    ← only active modes in Phase 181
PAPER_SELECTIVE   ← placeholder (API rejects)
LIVE_ASSISTED     ← placeholder
LIVE_AUTO         ← placeholder
```

## Safety

- **PAPER_RESEARCH + live gateway (port 7496)** → all execution **BLOCKED**
- **Live modes + paper gateway** → blocked (modes not enabled anyway)
- **UNKNOWN port** → blocked for paper research

## Paper research flow

```
Autonomous regime (feed) → PaperProbeRequest → qualification filter
  → 1-share MKT paper order → lifecycle (SUBMITTED → OPEN → CLOSED)
  → MFE/MAE poll (5s) → manual exit → analytics persistence
```

Qualified regimes (broad coverage, no selection bias):

- EARLY_EXPANSION, INSTITUTIONAL_PERSISTENCE, SHALLOW_PULLBACK_CONTINUATION
- VWAP_ACCEPTANCE, COMPRESSION_BREAKOUT, HEALTHY_EXTENSION, PERSISTENT_CONTINUATION

Blocked: EXHAUSTION_DRIFT, FAILED_EXPANSION, DEGRADING

## API (`/api/paper-execution`)

- `GET /status` — mode, gateway, safety
- `PUT /mode` — `{ "mode": "OFF" | "PAPER_RESEARCH" }`
- `POST /probe` — submit 1-share research probe
- `GET /monitor` — orders, positions, history, analytics
- `POST /{id}/close` — manual exit with optional `exitPrice`

## UI

- **AUTO EXECUTION** switch on dashboard (OFF / PAPER RESEARCH)
- **Execution Monitor** (`/execution-monitor`) — lifecycle separate from scanner

## Persistence

Table `paper_execution_records` (H2/JPA) — fills, slippage, MFE/MAE, realized R, separate from replay cache.

## Not in Phase 181

Live trading, scaling, pyramiding, auto exits, auto adds.

## Future path

1. Enable `PAPER_SELECTIVE` with filters after research dataset matures  
2. `LIVE_ASSISTED` — human confirm per order  
3. `LIVE_AUTO` — only after safety + stats gates  
