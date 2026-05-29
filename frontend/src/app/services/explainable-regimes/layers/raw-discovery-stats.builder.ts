import {
  DiscoveredStrategy,
  PreExpansionFeatureVector
} from '../../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { ExplainableClusterContext } from '../explainable-regime.models';
import { REGIME_FORMULAS, REGIME_THRESHOLDS } from '../regime-threshold-engine';
import { RawDiscoveryStatLine } from './explainability-layer.models';

/** Phase 208 — percentile / miner internals (collapsed panel only). */
export class RawDiscoveryStatsBuilder {
  build(strategy: DiscoveredStrategy, ctx?: ExplainableClusterContext): RawDiscoveryStatLine[] {
    if (!ctx?.centroid || !ctx.breakpoints) {
      return (strategy.conditions ?? []).map(c => ({
        dimension: c.dimension,
        label: c.label,
        value: c.value
      }));
    }
    const v = ctx.centroid;
    const bp = ctx.breakpoints;
    const out: RawDiscoveryStatLine[] = [];
    const push = (dim: string, label: string, raw: number, bpKey: string, suffix = '') => {
      const breaks = bp[bpKey] ?? [];
      const pct = percentileRank(raw, breaks);
      out.push({
        dimension: dim,
        label,
        value: `raw=${round(raw)}${suffix} · cluster p${pct} · pop p80≈${round(breaks[3] ?? raw)}${suffix}`
      });
    };
    push('rvol', 'Relative volume (miner)', decodeQ(v.rvolQ, bp['rvol'] ?? []), 'rvol', 'x');
    push('session', 'Session bucket', decodeQ(v.sessionQ, bp['session'] ?? []), 'session', 'm');
    push('vwap', 'VWAP distance quantile', decodeQ(v.vwapDistQ, bp['vwap'] ?? []), 'vwap');
    push('trend', 'Trend alignment quantile', decodeQ(v.trendQ, bp['trend'] ?? []), 'trend', '%');
    push('volatility', 'Volatility quantile', decodeQ(v.volatilityQ, bp['volatility'] ?? []), 'volatility');
    push('conviction', 'Conviction quantile', decodeQ(v.convictionQ, bp['conviction'] ?? []), 'conviction', '%');
    if (v.extended) {
      out.push({ dimension: 'extended', label: 'Extension flag', value: 'extended=1 (structure penalty in formula)' });
    }
    out.push({
      dimension: 'structure_formula',
      label: 'Structure formula ref',
      value: REGIME_FORMULAS['structureScore'] ?? 'structureScore composite'
    });
    out.push({
      dimension: 'rvol_eng_threshold',
      label: 'Engineering RVOL gate',
      value: `≥ ${REGIME_THRESHOLDS.velocity.rvolSustainedMin} (not percentile)`
    });
    out.push({
      dimension: 'sample',
      label: 'Cluster sample',
      value: `n=${strategy.sampleCount} · WR=${strategy.winRate}% · avgR=${strategy.avgR.toFixed(2)}`
    });
    return out;
  }
}

function decodeQ(q: number, breaks: number[]): number {
  const idx = Math.min(4, Math.max(0, q));
  return breaks[idx] ?? breaks[breaks.length - 1] ?? q;
}

function percentileRank(raw: number, breaks: number[]): number {
  for (let i = 0; i < breaks.length; i++) {
    if (raw <= breaks[i]) return (i + 1) * 20;
  }
  return 80;
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
