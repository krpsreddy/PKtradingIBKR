import { ContinuationClassification, ContinuationPromotionInput } from './continuation-promotion.models';
import { HealthyContinuationEngine } from './healthy-continuation-engine';
import { isReclaimSignal, isSecondLegSignal } from './continuation-promotion.util';

/** Distinguish TRUE EXHAUSTION from HEALTHY CONTINUATION DIGESTION. */
export class ContinuationVsExhaustionEngine {
  private readonly healthy = new HealthyContinuationEngine();

  classify(input: ContinuationPromotionInput): ContinuationClassification {
    if (this.isLateExtension(input)) return 'LATE_EXTENSION';
    if (this.isTrueExhaustion(input)) return 'TRUE_EXHAUSTION';
    if (this.isFailedContinuation(input)) return 'FAILED_CONTINUATION';
    if (isSecondLegSignal(input) && (input.continuationAcceptance === 'WEAK_ACCEPTANCE' || input.continuationAcceptance === 'NEUTRAL_ACCEPTANCE')) {
      return 'SECOND_LEG_ACCEPTANCE';
    }
    if (isReclaimSignal(input) && (input.pullbackStability === 'STABLE' || input.pullbackStability === 'VERY_STABLE')) {
      return 'INSTITUTIONAL_RECLAIM';
    }
    if (input.pullbackStability === 'STABLE' || input.pullbackStability === 'VERY_STABLE') {
      return 'CONTROLLED_PULLBACK';
    }
    if (this.isTrendDigestion(input)) return 'TREND_DIGESTION';
    if (this.healthy.isHealthy(input)) return 'HEALTHY_CONTINUATION';
    return 'FAILED_CONTINUATION';
  }

  isDigestionNotExhaustion(input: ContinuationPromotionInput): boolean {
    const c = this.classify(input);
    return c !== 'TRUE_EXHAUSTION' && c !== 'FAILED_CONTINUATION' && c !== 'LATE_EXTENSION';
  }

  private isTrueExhaustion(input: ContinuationPromotionInput): boolean {
    if (input.extended && (input.trendAlignment ?? 0) < 45) return true;
    if (input.continuationAcceptance === 'FAILING_ACCEPTANCE' && input.pullbackStability === 'FAILING') return true;
    if (input.fakeoutRisk === 'HIGH' || input.fakeoutRisk === 'EXTREME') return true;
    if (input.sequencingState === 'FAILED_ACCEPTANCE' || input.sequencingState === 'EXHAUSTING') return true;
    return false;
  }

  private isFailedContinuation(input: ContinuationPromotionInput): boolean {
    return input.continuationAcceptance === 'FAILING_ACCEPTANCE'
      || input.pullbackStability === 'FAILING'
      || input.sequencingState === 'FAILED_ACCEPTANCE';
  }

  private isLateExtension(input: ContinuationPromotionInput): boolean {
    return input.extended === true
      && (input.sessionTimeMinutes ?? 0) > 120
      && (input.rvol ?? 0) > 5;
  }

  private isTrendDigestion(input: ContinuationPromotionInput): boolean {
    return (input.pullbackStability === 'STABLE' || input.continuationAcceptance === 'NEUTRAL_ACCEPTANCE')
      && (input.trendAlignment ?? 0) >= 50
      && !input.extended;
  }
}
