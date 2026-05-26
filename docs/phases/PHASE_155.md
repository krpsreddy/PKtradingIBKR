# Phase 155 — Signal-Centric Replay Navigation

## Goal

Replay as an **execution review workstation**: browse all signals for a symbol across 60D, click any row, and instantly jump to the correct session, candle, and execution context.

## Backend

### `GET /api/replay-cache/signal-index/{symbol}`

Compact cross-session index (no full replay payloads).

**Query params:** `from`, `to`, `decision`, `narrative`, `quality`, `result`, `page`, `size`

**Sources merged:**
- `evaluated_signal_snapshots`
- `replay_session_snapshots` (timeline only for index build)
- `decision_feedback_snapshots` (enrichment by `signalId`)

**Response:**
```json
{
  "rows": [ReplaySignalIndexRow],
  "total": 412,
  "page": 0,
  "size": 500,
  "generatedAt": 1710000000000,
  "analyticsVersion": 1
}
```

Replay snapshot JSON loads **on click only** via existing `/api/replay-cache/snapshot/{symbol}/{sessionDate}`.

## Frontend module

`frontend/src/app/services/signal-centric-replay/`

| File | Role |
|------|------|
| `signal-centric-replay.models.ts` | `ReplaySignalIndexRow`, filters, launch context |
| `signal-replay-index.service.ts` | API client for signal-index endpoint |
| `historical-signal-query.engine.ts` | Query param builder |
| `multi-session-signal-index.engine.ts` | Dedupe, display rows, visual tones |
| `signal-explorer-state.service.ts` | Client filters, smart shortcuts |
| `signal-replay-navigation.engine.ts` | Cross-session list navigation |
| `signal-jump-context.engine.ts` | Launch context + bar resolution |
| `signal-replay-focus.engine.ts` | Journey, exit bar, jump kinds |
| `signal-replay-workflow.service.ts` | Orchestrator |

## UX

- **Signal Explorer** panel uses Phase 155 index via `SignalExplorerSynthesisService` → `SignalReplayWorkflowService`
- Global table: Date · Time · Signal · Quality · Conv · Result
- Smart shortcuts: Best Winners, Elite Reclaims, Trap Days, etc.
- **Replay** → REVIEW mode at signal candle
- **Train** → TRAINING mode, 10 bars before signal
- Signal journey breadcrumb after selection

## Launch flow

1. Click row → build `SignalReplayLaunchContext`
2. Load session snapshot on demand
3. Seek to `replayIndex` (train: index − 10 bars)
4. Set display mode REVIEW or TRAINING
5. Snap chart viewport to signal candle

## Non-goals

No changes to trading logic, thresholds, or decision engines — navigation and discoverability only.
