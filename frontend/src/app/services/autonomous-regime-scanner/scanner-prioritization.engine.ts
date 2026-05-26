import { ScannerOpportunityCard, ScannerSectionId } from './autonomous-regime-scanner.models';
import { sectionForType } from './scanner-ranking.engine';

/** Phase 166 — autonomous conviction → expansion → trigger integrity. */
export function compareScannerCards(a: ScannerOpportunityCard, b: ScannerOpportunityCard): number {
  if (b.convictionScore !== a.convictionScore) return b.convictionScore - a.convictionScore;
  if (b.expansionProbability !== a.expansionProbability) return b.expansionProbability - a.expansionProbability;
  return b.triggerIntegrity - a.triggerIntegrity;
}

export function bucketBySection(cards: ScannerOpportunityCard[]): Record<ScannerSectionId, ScannerOpportunityCard[]> {
  const buckets: Record<ScannerSectionId, ScannerOpportunityCard[]> = {
    HIGH_CONTINUATION: [],
    EARLY_EXPANSION: [],
    INSTITUTIONAL_PERSISTENCE: [],
    HEALTHY_PULLBACK: [],
    COMPRESSION_BREAKOUT: [],
    EXHAUSTION_AVOID: []
  };

  for (const card of cards) {
    buckets[sectionForType(card.opportunityType)].push(card);
  }

  for (const key of Object.keys(buckets) as ScannerSectionId[]) {
    buckets[key].sort(compareScannerCards);
  }
  return buckets;
}

export function topOpportunities(cards: ScannerOpportunityCard[], limit = 12): ScannerOpportunityCard[] {
  return [...cards]
    .filter(c => c.action !== 'AVOID')
    .sort(compareScannerCards)
    .slice(0, limit);
}
