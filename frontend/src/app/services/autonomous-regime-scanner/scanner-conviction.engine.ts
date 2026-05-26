import { ScannerOpportunityCard } from './autonomous-regime-scanner.models';
import { convictionCalibrationEngine } from '../conviction-calibration/conviction-calibration.engine';

/** Composite autonomous conviction score (0–100) via Phase 169 calibration. */
export function computeConvictionScore(card: Omit<ScannerOpportunityCard, 'convictionScore' | 'rank'>): number {
  if (card.opportunityType === 'LATE_STAGE_EXHAUSTION') {
    return Math.max(0, Math.min(100, Math.round(100 - card.exhaustionProbability * 0.6)));
  }
  const input = convictionCalibrationEngine.fromScannerCard(card as ScannerOpportunityCard);
  return convictionCalibrationEngine.calibrate(input).convictionScore;
}

export function applyConvictionScores(
  cards: ScannerOpportunityCard[],
  familyBoost?: (opportunityType: string) => number
): ScannerOpportunityCard[] {
  const inputs = cards.map(c => convictionCalibrationEngine.fromScannerCard(c));
  const calibrated = convictionCalibrationEngine.calibrateCohort(inputs);
  const scored = cards.map((c, i) => {
    const boost = familyBoost?.(c.opportunityType) ?? 0;
    const convictionScore = Math.min(100, calibrated[i].convictionScore + boost);
    return {
      card: { ...c, convictionScore },
      priority: calibrated[i].scannerPriority
    };
  });

  return scored
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.card.expansionProbability !== a.card.expansionProbability) {
        return b.card.expansionProbability - a.card.expansionProbability;
      }
      return b.card.executionQuality - a.card.executionQuality;
    })
    .map((s, i) => ({ ...s.card, rank: i + 1 }));
}
