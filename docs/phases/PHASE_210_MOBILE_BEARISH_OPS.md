# Phase 210 — Mobile Bearish Operations + Cleaner Trader Screen

## Goal

Flutter PK Live Trader as a lightweight **bidirectional execution terminal** (not a control dashboard).

## Backend

- `GET /api/live-trader/snapshot` includes `topBearishOpportunities` (max 5).
- `TopBearishOpportunitySelector` filters PUT **A+** / **A**, HIGH breakdown, squeeze risk &lt; 75.
- Reuses Phase 209 `BearishOperationalService` assessments — no extra polling.

## Mobile Trader tab

**Kept:** SCAN, AUTO, KILL (`ExecutionControlToggles`)

**Moved to Monitor:** TELEGRAM, HYDRATE (`RuntimeControlsPanel`)

**Sections (order):** IBKR → execution controls → hero → portfolio → TOP RANKED → TOP BEARISH → degrading

## UI

- Compact hero (smaller lifecycle, single narrative line, top-right LIVE/DELAYED/STALE badge).
- Ranked rows: green / red / yellow left accent + chips (LONG BLOCKED, CHOP RISK, PUT A+, etc.).
- Bearish cards: red accent, PUT grade, narrative.

## Safety

No research panels, no new polling loops, no auto PUT execution.
