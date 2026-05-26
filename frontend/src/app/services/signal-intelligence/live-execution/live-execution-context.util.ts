import { MarketRegime, SignalSnapshot } from '../../../models/signal-intelligence.model';
import { AutonomousOpportunityType } from '../../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { resolveAutonomousOpportunityFromLabel } from '../../../utils/autonomous-terminology.util';
import { LiveExecutionContext, PremarketExtensionBucket } from './live-execution.models';
import { breadthBucket, premarketBucket, rvolBucket, timeWindow } from '../edge-discovery/edge-cluster-metrics.util';

export function normalizeSetup(raw?: string | null): AutonomousOpportunityType {
  return resolveAutonomousOpportunityFromLabel(raw);
}

export function normalizeRegime(raw?: string | null): MarketRegime {
  const u = (raw ?? 'TREND').toUpperCase();
  if (u.includes('CHOP')) return 'CHOP';
  if (u.includes('BREAK')) return 'BREAKOUT';
  if (u.includes('CALM')) return 'CALM';
  if (u.includes('EXIT')) return 'EXITING';
  return 'TREND';
}

export function premarketExtensionBucket(pct: number): PremarketExtensionBucket {
  const abs = Math.abs(pct);
  if (abs < 2) return '0–2%';
  if (abs < 5) return '2–5%';
  if (abs < 8) return '5–8%';
  return '8%+';
}

export function extensionPctFromContext(ctx: LiveExecutionContext): number {
  if (ctx.premarketExtensionPct != null) return Math.abs(ctx.premarketExtensionPct);
  return Math.abs((ctx.vwapDistance ?? 0) * 100);
}

export function breadthFromContext(ctx: LiveExecutionContext): string {
  const t = ctx.trendAlignment ?? 50;
  if (t >= 70) return 'STRONG';
  if (t >= 50) return 'MID';
  return 'WEAK';
}

export function rvolFromContext(ctx: LiveExecutionContext): string {
  return rvolBucket(ctx.rvol ?? 1);
}

export function timeFromContext(ctx: LiveExecutionContext): string {
  return timeWindow(ctx.sessionTimeMinutes ?? 999);
}

export function snapshotFromContext(ctx: LiveExecutionContext): Partial<SignalSnapshot> {
  const ext = extensionPctFromContext(ctx);
  return {
    symbol: ctx.symbol.toUpperCase(),
    signalType: normalizeSetup(ctx.signalType) as SignalSnapshot['signalType'],
    marketRegime: normalizeRegime(ctx.marketRegime),
    rvol: ctx.rvol ?? 1,
    vwapDistance: ext / 100,
    trendAlignment: ctx.trendAlignment ?? 50,
    sessionTimeMinutes: ctx.sessionTimeMinutes ?? 999
  };
}

export function premarketBucketFromContext(ctx: LiveExecutionContext): string {
  return premarketBucket(snapshotFromContext(ctx) as SignalSnapshot);
}

export function breadthBucketFromContext(ctx: LiveExecutionContext): string {
  return breadthBucket(snapshotFromContext(ctx) as SignalSnapshot);
}

export function gateLabel(state: string): string {
  switch (state) {
    case 'EDGE_ACTIVE': return 'EDGE ACTIVE';
    case 'SELECTIVE': return 'SELECTIVE';
    case 'REDUCE_SIZE': return 'REDUCE SIZE';
    case 'NO_EDGE': return 'NO EDGE';
    case 'TOXIC': return 'TOXIC';
    default: return state.replace(/_/g, ' ');
  }
}
