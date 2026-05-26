# Replay Cache Architecture

Phase 149 — incremental replay and snapshot persistence.

## Tables

### `replay_session_snapshots`

| Column | Purpose |
|--------|---------|
| symbol, session_date | Unique session key |
| analytics_version | Staleness on version bump |
| candles_hash | Staleness on candle change |
| replay_status | READY · STALE · PROCESSING · FAILED |
| replay_payload_json | Full ReplayHistoryDto |
| timeline_json | Timeline events (denormalized) |
| indicator_snapshot_json | Last bar indicators (precomputed) |

### `replay_session_metadata`

Tracks `last_replay_at`, `replay_duration_ms`, signal/transition counts.

## Staleness

```
fresh = READY && analyticsVersion match && candlesHash match
```

## Incremental replay algorithm

```
for each sessionDate in lookback window:
  hash = SHA256(session candles)
  if snapshot fresh(hash): use cache
  else: replaySession() → persist snapshot
return all sessions (cached + newly replayed)
```

## Frontend cache layers

1. **PostgreSQL** — server replay snapshots (source of truth for replay)
2. **localStorage** — `replay-snapshot-cache-v1` (client fast path)
3. **Evaluated signals** — Phase 147 `evaluated_signal_snapshots` (evaluation outcomes)

## API vs legacy

| Endpoint | Use |
|----------|-----|
| `POST /api/replay-cache/incremental-replay/{symbol}` | **Preferred** — cache-first |
| `GET /replay/bulk/{symbol}` | Legacy fallback |

## UI phase labels

| Phase | Label |
|-------|-------|
| snapshots | Loading replay snapshots… |
| validate | Validating cached analytics… |
| stale-replay | Replaying stale sessions… |
| evaluate | Evaluating signals… |
| enrich | Background enrichment… |
