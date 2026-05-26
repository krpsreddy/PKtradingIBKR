import { ContinuationPromotionInput } from './continuation-promotion.models';
import { InstitutionalReclaimStat } from './continuation-promotion.models';
import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { confidenceTier, isReclaimSignal, mfeR, round2 } from './continuation-promotion.util';
import { classifyEntryLocation } from '../winner-decomposition/winner-decomposition.util';

/** VWAP reclaim hold + first pullback — institutional entry promotion. */
export class InstitutionalReclaimPromotionEngine {

  qualifies(input: ContinuationPromotionInput): boolean {
    if (!isReclaimSignal(input)) return false;
    const pull = input.pullbackStability ?? '';
    return pull === 'STABLE' || pull === 'VERY_STABLE'
      || input.sequencingState === 'RECLAIM_CONFIRMED'
      || input.sequencingState === 'PULLBACK_STABILIZING';
  }

  stats(signals: SignalSnapshot[]): InstitutionalReclaimStat[] {
    const reclaim = signals.filter(s => {
      const loc = classifyEntryLocation(s);
      return loc === 'VWAP_RECLAIM' || loc === 'RECLAIM' || (s.sourceSignalType ?? '').includes('PULL');
    });
    if (!reclaim.length) return [];

    const wins = reclaim.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5).length;
    return [{
      profile: 'VWAP reclaim hold after first pullback',
      count: reclaim.length,
      winRate: round2((wins / reclaim.length) * 100),
      avgR: round2(reclaim.reduce((n, s) => n + mfeR(s), 0) / reclaim.length),
      confidence: confidenceTier(reclaim.length)
    }];
  }
}
