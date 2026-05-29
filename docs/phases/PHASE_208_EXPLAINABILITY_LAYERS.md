# Phase 208 — Explainability Layer Refactor

Separates semantic reasoning from raw engineering logic while keeping exact thresholds visible.

## Unified 7-section layout (bullish + bearish)

1. **Structural summary** — human-readable regime sentence  
2. **Exact trigger conditions** — `Label: actual >= threshold ✓`  
3. **Structural interpretation** — trader language (no percentiles)  
4. **Confidence contributors** — scoring deltas in isolated block  
5. **Lifecycle evolution** — phased path  
6. **Invalidates if** — clear invalidation rules  
7. **Formula debug** — collapsed by default  

**Raw discovery statistics** — separate collapsible panel (percentiles, miner internals, z-scores)

## Module (`services/explainable-regimes/layers/`)

| File | Role |
|------|------|
| `explainability-layer.models.ts` | Layered view types |
| `engineering-trigger.util.ts` | Trigger line formatting |
| `bullish-explainability-layer.builder.ts` | Bullish layers from `ExplainableRegimeExplanation` |
| `bearish-explainability-layer.builder.ts` | Bearish layers + full engineering gates |
| `raw-discovery-stats.builder.ts` | Percentile/miner data (not main flow) |
| `explainability-layer.service.ts` | Facade |

## Engineering gates exposed

**Bullish:** RVOL, AccelerationIntegrity, Persistence, TrendAlignment, VWAPDistance, ExpansionProbability, Exhaustion, StructureScore, FalseBreakout  

**Bearish:** ReclaimFailureScore, RejectionPersistence, BreakdownAcceleration, DistributionPersistence, DownsideRVOL, SqueezeRisk, BreakdownProbability, MarketWeakness  

## UI

- Cluster table shows summary + `N/M gates` (not percentile dump)
- Main panel uses ordered sections
- Formula debug + raw stats collapsed unless expanded
