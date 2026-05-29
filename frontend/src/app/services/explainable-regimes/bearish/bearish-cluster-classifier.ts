import { DiscoveredStrategy } from '../../signal-intelligence/autonomous-discovery/autonomous-discovery.models';

/** Phase 207 — separates bearish clusters from bullish expansion mining. */
export function isBearishStrategy(strategy: DiscoveredStrategy): boolean {
  const raw = (
    strategy.name +
    ' ' +
    strategy.kind +
    ' ' +
    (strategy.conditions?.map(c => `${c.label} ${c.value}`).join(' ') ?? '') +
    ' ' +
    strategy.featureKey
  ).toUpperCase();

  const bearishKw = [
    'FAILED', 'RECLAIM', 'REJECT', 'BREAKDOWN', 'DISTRIB', 'PANIC', 'EXHAUST',
    'REVERSAL', 'COLLAPSE', 'BEAR', 'PUT', 'WEAK', 'LOWER', 'FLUSH', 'TRAP'
  ];
  if (bearishKw.some(k => raw.includes(k))) return true;
  if (strategy.avgR < 0 && strategy.continuationPct < 45) return true;
  if (strategy.fakeoutPct > 40 && strategy.winRate < 48) return true;
  return false;
}

export function bearishClusterDisplayName(strategy: DiscoveredStrategy, index: number): string {
  const id = strategy.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || String(index).padStart(3, '0');
  const raw = strategy.name.toUpperCase();
  if (raw.includes('RECLAIM')) return `FAILED_RECLAIM_CLUSTER_${id}`;
  if (raw.includes('VWAP') || raw.includes('REJECT')) return `VWAP_REJECTION_CLUSTER_${id}`;
  if (raw.includes('PANIC')) return `PANIC_EXPANSION_CLUSTER_${id}`;
  if (raw.includes('DISTRIB')) return `DISTRIBUTION_BREAK_CLUSTER_${id}`;
  if (raw.includes('EXHAUST')) return `EXHAUSTION_REVERSAL_CLUSTER_${id}`;
  if (raw.includes('WEAK') || raw.includes('BOUNCE')) return `WEAK_BOUNCE_FAILURE_CLUSTER_${id}`;
  if (raw.includes('ACCEL') || raw.includes('BREAK')) return `BREAKDOWN_ACCEL_CLUSTER_${id}`;
  return `BREAKDOWN_ACCEL_CLUSTER_${id}`;
}
