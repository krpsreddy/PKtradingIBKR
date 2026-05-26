import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { NanoScanResult } from '../real-time-execution/nano-scanner.engine';
import { PersistenceTier } from './dominant-opportunity.models';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Sustained continuation beats brief spikes. */
export function continuationDominanceScore(
  card: ScannerOpportunityCard,
  nano?: NanoScanResult
): number {
  const persistence = card.continuationPersistence ?? 0;
  const shallow =
    card.opportunityType === 'SHALLOW_PULLBACK_CONTINUATION' ? 14 : 0;
  const healthyExt = card.expansionProbability >= 55 && card.exhaustionProbability < 35 ? 10 : 0;
  const spikePenalty = card.isRising && persistence < 45 ? -18 : 0;
  const nanoPersist = (nano?.opportunityAge ?? 0) * 1.8;
  const velocity = Math.min(20, (nano?.convictionVelocity ?? card.popVelocity ?? 0) * 0.12);

  return clamp(
    Math.round(persistence * 0.55 + shallow + healthyExt + nanoPersist + velocity + spikePenalty)
  );
}

export function persistenceTier(score: number): PersistenceTier {
  if (score >= 78) return 'ELITE';
  if (score >= 58) return 'STRONG';
  if (score >= 38) return 'MODERATE';
  return 'WEAK';
}
