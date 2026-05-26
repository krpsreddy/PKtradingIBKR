# Phase 166 — Autonomous Execution Shell Migration

## Summary

Replaced the legacy momentum sidebar (Hot Momentum, Opening Momentum, Failed Momentum, Continuation Setups) with **10 autonomous execution regime groups** driven by cached scanner snapshots.

## Sidebar Regime Groups

1. High Conviction Continuations
2. Early Expansion
3. Institutional Persistence
4. Healthy Shallow Pullbacks
5. VWAP Acceptance
6. Compression Breakouts
7. Trend Resumption
8. Exhaustion / Do Not Chase
9. Regime Transitions
10. Watchlist Priorities

## Sort Order

All regime rows rank by:

1. `convictionScore` DESC
2. `expansionProbability` DESC
3. `triggerIntegrity` DESC

Rising symbols auto-pin briefly and show **NEW EXPANSION** pulse.

## Top Card

Legacy **Best Current Setup** replaced with **Top Autonomous Opportunity** (`app-top-autonomous-opportunity-card`).

Shows: symbol, action, conviction, entry zone, risk, why-now bullets.

## Watchlist

When scanner snapshot is available, watchlist auto-groups by autonomous regime type (High Conviction, Healthy PB, Exhaustion, etc.).

## Edge Lab Integration

Clicking regime sidebar symbols emits `executionFocus` → opens Review **Edge Lab → Execution Cards** tab with symbol focus.

## New Modules

- `scanner-state.engine.ts` — live states (`EARLY_EXPANSION`, `EXHAUSTION_DRIFT`, etc.)
- `sidebar-regime-groups.engine.ts` — maps `ScannerSnapshot` → sidebar groups + watchlist buckets
- `top-autonomous-opportunity-card/` — top opportunity card component

## Verification

```bash
cd frontend && npm run build
```

Sidebar should show autonomous regime sections with conviction scores (typically 70%+) when backend scanner API is live.
