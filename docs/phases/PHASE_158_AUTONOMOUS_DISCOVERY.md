# Phase 158 — Autonomous Strategy Discovery Engine

**Status:** Implemented  
**Scope:** Advisory-only — mines pre-expansion conditions and invents profitable entry archetypes from evaluated history

---

## Goal

Stop relying on manually designed signal types (MOM, BREAKOUT, VWAP reclaim, etc.). Discover recurring pre-expansion conditions that precede large profitable moves directly from 60D replay/evaluated intelligence.

---

## Module

```
frontend/src/app/services/signal-intelligence/autonomous-discovery/
├── autonomous-discovery.models.ts
├── autonomous-discovery.util.ts
├── historical-pattern-miner.engine.ts
├── pre-expansion-feature-extractor.engine.ts
├── unsupervised-strategy-clustering.engine.ts
├── winner-sequence-analysis.engine.ts
├── entry-archetype-discovery.engine.ts
├── pullback-pattern-discovery.engine.ts
├── continuation-regime-miner.engine.ts
├── statistical-edge-ranking.engine.ts
└── autonomous-discovery-synthesis.service.ts
```

---

## Discovery Method

1. **Feature extraction** — numeric quantile vectors from RVOL, session timing, VWAP distance, trend alignment, volatility, conviction, structure score (no legacy signal-type labels in cluster keys)
2. **Pattern mining** — hash recurring pre-expansion combinations across evaluated snapshots
3. **Unsupervised clustering** — merge nearby quantile bins into emergent archetypes
4. **Auto-naming** — `EXPANSION_CLUSTER_N`, `CONTINUATION_PROFILE_N`, `PERSISTENCE_PATTERN_N`
5. **Governance conflict detection** — profitable clusters where live decision engine would WAIT/AVOID

---

## Page

Route: `/autonomous-discovery`  
Title: **AUTONOMOUS STRATEGY DISCOVERY LAB**

Sections:
1. Discovered Strategies
2. Biggest Winner Clusters
3. Pre-Expansion Conditions
4. Ideal Entry Zones (+ optimal pullback structures)
5. Governance Conflicts
6. Replay Review (jumps to dashboard replay)

---

## Safety

- Advisory only — no auto-trading, no threshold mutation, no strategy activation
- n < 10 = not authoritative
- n < 25 = low confidence

---

## Integration

| Surface | Integration |
|---------|-------------|
| **Lazy enrichment** | `AutonomousDiscoverySynthesisService.refresh()` after hydration |
| **Replay review** | `ReplayLaunchIntentService` → dashboard `jumpToHistoricalSignal()` |
