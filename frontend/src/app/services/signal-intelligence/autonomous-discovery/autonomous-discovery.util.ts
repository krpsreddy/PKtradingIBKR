import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import {
  DiscoveredCondition,
  DiscoveredStrategyKind,
  DiscoveryConfidenceTier,
  IdealEntryZoneKind,
  PreExpansionFeatureVector
} from './autonomous-discovery.models';

export const MIN_AUTHORITATIVE = 10;
export const MIN_LOW_CONFIDENCE = 25;
export const ELITE_R_THRESHOLD = 2;
export const BIG_DOLLAR_MOVE = 7;

export function confidenceTier(n: number): DiscoveryConfidenceTier {
  if (n < MIN_AUTHORITATIVE) return 'INSUFFICIENT';
  if (n < MIN_LOW_CONFIDENCE) return 'LOW';
  if (n < 50) return 'MODERATE';
  return 'HIGH';
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function mfeR(s: SignalSnapshot): number {
  return s.evaluation?.mfeR ?? 0;
}

export function mfeDollars(s: SignalSnapshot): number {
  const ev = s.evaluation;
  if (!ev) return 0;
  if (ev.mfe > 0) return ev.mfe;
  return (ev.mfePercent / 100) * s.entryPrice;
}

export function sessionDateFromTs(ts: number): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function sessionKey(s: SignalSnapshot): string {
  return `${s.symbol}|${sessionDateFromTs(s.timestamp)}`;
}

export function isEliteWinner(s: SignalSnapshot): boolean {
  const r = mfeR(s);
  return r >= ELITE_R_THRESHOLD || s.evaluation?.hit2R === true;
}

export function isBigDollarWinner(s: SignalSnapshot): boolean {
  return mfeDollars(s) >= BIG_DOLLAR_MOVE || mfeR(s) >= 3;
}

export function captureStageCode(s: SignalSnapshot): 0 | 1 | 2 {
  if (s.captureStage === 'TRIGGERED') return 1;
  if (s.captureStage === 'ENTERED') return 2;
  return 0;
}

export function regimeCode(regime: string | undefined): number {
  switch (regime) {
    case 'TREND': return 0;
    case 'BREAKOUT': return 1;
    case 'CHOP': return 2;
    case 'CALM': return 3;
    case 'EXITING': return 4;
    default: return 2;
  }
}

/** Build quantile breakpoints from population (data-driven, not fixed thresholds). */
export function buildQuantileBreakpoints(values: number[], buckets = 5): number[] {
  const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return [0, 0.25, 0.5, 0.75, 1];
  const pts: number[] = [];
  for (let i = 1; i < buckets; i++) {
    const idx = Math.floor((i / buckets) * sorted.length);
    pts.push(sorted[Math.min(idx, sorted.length - 1)]);
  }
  return pts;
}

export function quantileIndex(value: number, breakpoints: number[]): number {
  if (!breakpoints.length) return 0;
  for (let i = 0; i < breakpoints.length; i++) {
    if (value <= breakpoints[i]) return i;
  }
  return breakpoints.length;
}

export function featureKey(v: PreExpansionFeatureVector): string {
  return [
    v.rvolQ, v.sessionQ, v.vwapDistQ, v.trendQ, v.volatilityQ, v.convictionQ,
    v.extended, v.captureStage, v.regimeCode, v.emaAligned, v.pullbackDepthQ,
    v.volumeAccelQ
  ].join(':');
}

export function clusterIndexFromKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 997) + 1;
}

export function strategyNameFor(
  kind: DiscoveredStrategyKind,
  key: string
): string {
  const n = clusterIndexFromKey(key);
  switch (kind) {
    case 'EXPANSION_CLUSTER': return `EXPANSION_CLUSTER_${n}`;
    case 'CONTINUATION_PROFILE': return `CONTINUATION_PROFILE_${n}`;
    case 'PERSISTENCE_PATTERN': return `PERSISTENCE_PATTERN_${n}`;
  }
}

export function classifyClusterKind(
  avgR: number,
  continuationPct: number,
  fakeoutPct: number
): DiscoveredStrategyKind {
  if (avgR >= 2.5 && continuationPct >= 65 && fakeoutPct < 25) return 'EXPANSION_CLUSTER';
  if (avgR >= 1.5 && continuationPct >= 55) return 'CONTINUATION_PROFILE';
  return 'PERSISTENCE_PATTERN';
}

export function inferIdealEntryZone(v: PreExpansionFeatureVector): IdealEntryZoneKind {
  if (v.pullbackDepthQ <= 1 && v.vwapDistQ <= 2) return 'PULLBACK_ENTRY';
  if (v.vwapDistQ <= 1) return 'RECLAIM_ENTRY';
  if (v.captureStage >= 1 && v.structureScore >= 55) return 'CONTINUATION_ADD';
  return 'DIRECT_BREAKOUT';
}

export function decodeQuantileLabel(
  dimension: string,
  q: number,
  breakpoints: number[],
  suffix = ''
): DiscoveredCondition {
  const bp = breakpoints[Math.min(q, breakpoints.length - 1)] ?? 0;
  const labels = ['very low', 'low', 'mid', 'high', 'very high'];
  return {
    dimension,
    label: dimension.replace(/_/g, ' '),
    value: `${labels[Math.min(q, 4)]}${suffix ? ` (${round2(bp)}${suffix})` : ''}`
  };
}

export function describeFeatureVector(
  v: PreExpansionFeatureVector,
  breakpoints: Record<string, number[]>
): DiscoveredCondition[] {
  const out: DiscoveredCondition[] = [];
  out.push(decodeQuantileLabel('relative_volume', v.rvolQ, breakpoints['rvol'] ?? []));
  out.push(decodeQuantileLabel('session_minutes', v.sessionQ, breakpoints['session'] ?? [], 'm'));
  out.push(decodeQuantileLabel('vwap_distance', v.vwapDistQ, breakpoints['vwap'] ?? []));
  out.push(decodeQuantileLabel('trend_alignment', v.trendQ, breakpoints['trend'] ?? []));
  out.push(decodeQuantileLabel('volatility', v.volatilityQ, breakpoints['volatility'] ?? []));
  out.push(decodeQuantileLabel('conviction', v.convictionQ, breakpoints['conviction'] ?? []));
  if (v.extended) out.push({ dimension: 'extended', label: 'extension', value: 'elevated at capture' });
  if (v.emaAligned) out.push({ dimension: 'ema', label: 'EMA structure', value: 'aligned' });
  if (v.volumeAccelQ >= 3) out.push({ dimension: 'volume_accel', label: 'volume acceleration', value: 'accelerating vs session baseline' });
  if (v.structureScore >= 55) out.push({ dimension: 'structure', label: 'structure score', value: `${v.structureScore}+` });
  if (v.pullbackDepthQ <= 1) out.push({ dimension: 'pullback', label: 'pullback depth', value: 'shallow' });
  return out.slice(0, 8);
}

export function groupBySession(signals: SignalSnapshot[]): Map<string, SignalSnapshot[]> {
  const map = new Map<string, SignalSnapshot[]>();
  for (const s of signals) {
    const k = sessionKey(s);
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  for (const [, rows] of map) {
    rows.sort((a, b) => a.timestamp - b.timestamp);
  }
  return map;
}
