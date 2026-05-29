# Phase 206 — Bullish & Bearish Discovery Intelligence

Separates continuation research from breakdown / PUT assist research in the Autonomous Strategy Discovery Lab.

## UI (Option A)

Tabs:

- **Bullish Discovery** — continuation, persistence, second-leg, VWAP acceptance
- **Bearish Discovery** — breakdown, rejection, PUT entry quality, squeeze risk
- Execution Telemetry (60D)
- Explainable Regimes
- Exit Validation

## Backend

| Piece | Role |
|-------|------|
| `DiscoveryDirection` | BULLISH / BEARISH filter |
| `DiscoveryDirectionClassifier` | Classifies snapshots (not inverted bullish) |
| `BullishRegimeFamilyMapper` | 8 bullish families |
| `BearishRegimeFamilyMapper` | 8 bearish families |
| `DiscoveryConfidenceScorer` | Bullish confidence |
| `BearishDiscoveryConfidenceScorer` | Breakdown survival + squeeze |
| `BullishDiscoveryInsightsEngine` | Continuation insights |
| `BearishDiscoveryInsightsEngine` | PUT / breakdown insights |
| `HistoricalBulkDiscoveryService.report(days, direction)` | Shared aggregation, separate cache |

## API

- `GET /api/discovery/historical-bulk/bullish?days=60`
- `GET /api/discovery/historical-bulk/bearish?days=60`
- `POST .../bullish/refresh` · `POST .../bearish/refresh`
- Legacy `GET /api/discovery/historical-bulk` → bullish

## Bearish-only report sections

- `putEntryQuality` — IDEAL_BREAKDOWN, FAILED_RECLAIM, LATE_FLUSH, etc.
- `squeezeRisk` — SqueezeRiskScore by context
- `breakdownProfiles` — breakdown survival, failed bounce, acceleration

## Historical vs live

- Bullish: regime performance (paper)
- Bearish: bearish assist telemetry + decision_trace PUT assists
