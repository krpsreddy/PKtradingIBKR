# Phase 150 — Replay UX + Viewport State Engine

## Goal

Decouple replay cursor from chart viewport so users can pause, inspect history, and pan/zoom without forced snapping.

## Module

`frontend/src/app/services/chart/replay-viewport/`

| File | Role |
|------|------|
| `replay-viewport.models.ts` | State machine types, constants |
| `replay-viewport-state.service.ts` | Observable interaction state |
| `replay-follow-mode.engine.ts` | Auto-follow eligibility |
| `replay-visible-range.engine.ts` | Initial + follow visible ranges (60-bar window) |
| `replay-inspection.engine.ts` | User pan/zoom → INSPECTING |
| `replay-playback-sync.engine.ts` | Throttled (80ms) viewport sync during PLAYING |
| `replay-viewport-persistence.service.ts` | sessionStorage per symbol+date |
| `replay-ux-synthesis.service.ts` | Orchestrator |

## Interaction states

| State | Viewport behavior |
|-------|-------------------|
| `PLAYING` | Auto-follow replay head (throttled) |
| `PAUSED` | Frozen replay, viewport independent |
| `INSPECTING` | User panned/zoomed, no auto-follow |
| `DETACHED_VIEW` | Playing but viewport frozen |
| `FOLLOWING_HEAD` | Jump-to-head resync |

## Chart integration

`TradingChartComponent` gates `fitContent`, `scrollToRealTime`, and `applyViewportFocus` during replay inspection. Replay bars append incrementally when possible.

## UI

- Detached banner + **Jump to Replay Head** (chart overlay + toolbar + replay panel)
- Replay head vertical marker on canvas overlay
- Minimap strip (viewport + head position)

## Constraints

UX/interaction only — no replay data, signal, narrative, or decision engine changes.
