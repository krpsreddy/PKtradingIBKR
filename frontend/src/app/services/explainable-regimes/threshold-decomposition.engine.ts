import { LiveRegimeInput, LiveRegimeMetrics } from '../live-regime-intelligence/live-regime.models';
import {
  DiscoveredCondition,
  DiscoveredStrategy,
  PreExpansionFeatureVector
} from '../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { REGIME_FORMULAS, REGIME_THRESHOLDS } from './regime-threshold-engine';
import { ExplainableClusterContext, NumericThresholdCheck } from './explainable-regime.models';

/** Decompose live + discovery features into numeric checks (no vague labels). */
export class ThresholdDecompositionEngine {
  decomposeLiveMetrics(input: LiveRegimeInput, metrics: LiveRegimeMetrics): NumericThresholdCheck[] {
    const depth = input.pullbackDepth ?? Math.abs(input.vwapDistance ?? 0);
    const volAccel = this.estimateVolumeAccel(input);
    return [
      metric('rvol', 'relative volume', input.rvol ?? 0, REGIME_THRESHOLDS.velocity.rvolSustainedMin, '>='),
      metric('volume_acceleration', 'volumeAccel vs session baseline', volAccel, REGIME_THRESHOLDS.volumeAccel.entryMin, '>='),
      metric('pullback_depth', 'pullback depth %', round(depth * 100), REGIME_THRESHOLDS.pullback.invalidationPullbackMax * 100, '<='),
      metric('structure_score', 'structure score', input.structureScore ?? input.trendAlignment ?? 0, REGIME_THRESHOLDS.structure.entryMin, '>='),
      metric('continuation_persistence', 'continuation persistence', metrics.continuationPersistenceScore, REGIME_THRESHOLDS.expansion.participationPersistMin, '>='),
      metric('acceleration_integrity', 'acceleration integrity', metrics.accelerationIntegrity, REGIME_THRESHOLDS.expansion.invalidationIntegrityMin, '>='),
      metric('expansion_probability', 'expansion probability', metrics.expansionProbability, REGIME_THRESHOLDS.expansion.participationExpMin, '>='),
      metric('exhaustion_probability', 'exhaustion score', metrics.exhaustionProbability, REGIME_THRESHOLDS.expansion.invalidationExhaustion, '<='),
      metric('vwap_distance', 'VWAP distance', input.vwapDistance ?? 0, 0, '>='),
      metric('session_minutes', 'session minutes', input.sessionTimeMinutes ?? 0, REGIME_THRESHOLDS.continuationWindow.endMin, '<=')
    ];
  }

  /** Numeric cluster conditions from centroid + population breakpoints. */
  decomposeClusterStrategy(
    strategy: DiscoveredStrategy,
    ctx?: ExplainableClusterContext
  ): DiscoveredCondition[] {
    if (!ctx?.centroid || !ctx.breakpoints) {
      return strategy.conditions;
    }
    const v = ctx.centroid;
    const bp = ctx.breakpoints;
    const out: DiscoveredCondition[] = [];
    const push = (dim: string, label: string, raw: number, bpKey: string, suffix = '') => {
      const breaks = bp[bpKey] ?? [];
      const p = percentileLabel(raw, breaks);
      out.push({
        dimension: dim,
        label,
        value: `${round(raw)}${suffix} (p${p.label}, threshold p80≈${round(breaks[3] ?? raw)}${suffix})`
      });
    };
    push('rvol', 'relative volume', decodeQuantileRaw(v.rvolQ, bp['rvol'] ?? []), 'rvol', 'x');
    push('session', 'session minutes', decodeQuantileRaw(v.sessionQ, bp['session'] ?? []), 'session', 'm');
    push('vwap', 'vwap distance', decodeQuantileRaw(v.vwapDistQ, bp['vwap'] ?? []), 'vwap');
    push('trend', 'trend alignment', decodeQuantileRaw(v.trendQ, bp['trend'] ?? []), 'trend', '%');
    push('volatility', 'volatility', decodeQuantileRaw(v.volatilityQ, bp['volatility'] ?? []), 'volatility');
    push('conviction', 'conviction', decodeQuantileRaw(v.convictionQ, bp['conviction'] ?? []), 'conviction', '%');
    if (v.extended) out.push({ dimension: 'extended', label: 'extension', value: 'extended=1 at capture (penalty −15 structure)' });
    if (v.emaAligned) out.push({ dimension: 'ema', label: 'EMA structure', value: 'emaAligned=1 (+10 structure)' });
    const accel = REGIME_THRESHOLDS.volumeAccel.breakpoints[v.volumeAccelQ] ?? 1;
    out.push({
      dimension: 'volume_accel',
      label: 'volume acceleration',
      value: `${accel}x baseline (Q${v.volumeAccelQ}/4, entry threshold ≥ ${REGIME_THRESHOLDS.volumeAccel.entryMin}x)`
    });
    out.push({
      dimension: 'structure',
      label: 'structure score',
      value: `${v.structureScore} (formula: ${REGIME_FORMULAS['structureScore']})`
    });
    return out;
  }

  private estimateVolumeAccel(input: LiveRegimeInput): number {
    const rvol = input.rvol ?? 0;
    return round(rvol / Math.max(1, 1.5));
  }
}

function metric(
  feature: string,
  formula: string,
  actual: number,
  threshold: number,
  operator: NumericThresholdCheck['operator']
): NumericThresholdCheck {
  const passed = operator === '>=' ? actual >= threshold
    : operator === '<=' ? actual <= threshold
    : operator === '>' ? actual > threshold
    : actual < threshold;
  return { feature, formula, actual: round(actual), threshold, operator, passed };
}

function decodeQuantileRaw(q: number, breaks: number[]): number {
  if (!breaks.length) return q;
  const idx = Math.min(4, Math.max(0, q));
  return breaks[idx] ?? breaks[breaks.length - 1] ?? 0;
}

function percentileLabel(raw: number, breaks: number[]): { label: string; pct: number } {
  let pct = 50;
  for (let i = 0; i < breaks.length; i++) {
    if (raw <= breaks[i]) {
      pct = (i + 1) * 20;
      break;
    }
    pct = 80 + (i === breaks.length - 1 ? 20 : 0);
  }
  return { label: String(Math.min(100, pct)), pct };
}

function round(v: number, d = 2): number {
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}
