import { LiveExecutionDecision } from '../live-decision/live-decision.models';
import {
  ContinuationArchetypeStats,
  ContinuationPromotionInput,
  ContinuationPromotionOverlay
} from './continuation-promotion.models';
import { ContinuationVsExhaustionEngine } from './continuation-vs-exhaustion.engine';
import { PullbackDigestionClassifierEngine } from './pullback-digestion-classifier.engine';
import { HealthyContinuationEngine } from './healthy-continuation-engine';
import {
  isPromotableStats,
  isWaitOrAvoid,
  isSecondLegSignal,
  isReclaimSignal,
  mapClassificationToEntryType,
  round2
} from './continuation-promotion.util';
import { classifyEntryLocation } from '../winner-decomposition/winner-decomposition.util';

/** Statistically calibrate governance — promote profitable continuation structures. */
export class ContinuationGovernanceRebalanceEngine {
  private readonly vsExhaustion = new ContinuationVsExhaustionEngine();
  private readonly digestion = new PullbackDigestionClassifierEngine();
  private readonly healthy = new HealthyContinuationEngine();

  promote(
    originalDecision: LiveExecutionDecision,
    input: ContinuationPromotionInput,
    archetypes: ContinuationArchetypeStats[]
  ): ContinuationPromotionOverlay {
    const classification = this.vsExhaustion.classify(input);
    const entryType = mapClassificationToEntryType(classification);
    const none: ContinuationPromotionOverlay = {
      active: false,
      classification,
      continuationEntryType: null,
      originalDecision,
      promotedDecision: originalDecision,
      promotionReason: '',
      suppressionOverride: '',
      statsBacked: false,
      expectedR: null,
      continuationPct: null,
      narrativeQuality: classification.replace(/_/g, ' '),
      advisoryOnly: true
    };

    if (!isWaitOrAvoid(originalDecision) && originalDecision !== 'REDUCE_SIZE') {
      return { ...none, active: originalDecision === 'FULL_EXECUTION', continuationEntryType: entryType };
    }

    if (classification === 'TRUE_EXHAUSTION' || classification === 'LATE_EXTENSION' || classification === 'FAILED_CONTINUATION') {
      return none;
    }

    const loc = this.resolveEntryLocation(input);
    const cont = input.continuationAcceptance ?? 'NEUTRAL_ACCEPTANCE';
    const archetype = archetypes.find(a => a.entryLocation === loc && a.continuationLevel === cont)
      ?? archetypes.find(a => a.promotable && a.archetype.includes('SECOND_LEG') && isSecondLegSignal(input))
      ?? archetypes.find(a => a.promotable && a.archetype.includes('VWAP') && isReclaimSignal(input));

    const statsOk = archetype?.promotable ?? this.fallbackPromotable(input, classification);
    const digestionOk = this.digestion.supportsPromotion(input) || this.healthy.isHealthy(input);

    if (!statsOk || !digestionOk) return none;

    const promotedDecision = this.resolvePromotedDecision(originalDecision, classification, archetype);
    if (promotedDecision === originalDecision) return none;

    return {
      active: true,
      classification,
      continuationEntryType: entryType,
      originalDecision,
      promotedDecision,
      promotionReason: this.promotionReason(classification, archetype),
      suppressionOverride: `Governance suppression reduced — ${archetype?.archetype ?? classification} historically profitable`,
      statsBacked: !!archetype?.promotable,
      expectedR: archetype ? round2(archetype.avgR) : null,
      continuationPct: archetype?.continuationPct ?? null,
      narrativeQuality: classification.replace(/_/g, ' '),
      advisoryOnly: true
    };
  }

  private resolveEntryLocation(input: ContinuationPromotionInput): string {
    if (isSecondLegSignal(input)) return 'SECOND_LEG';
    if (isReclaimSignal(input)) return 'VWAP_RECLAIM';
    if (input.sequencingState === 'CONTINUATION_ACCEPTED') return 'POST_ACCEPTANCE_CONTINUATION';
    if ((input.sessionTimeMinutes ?? 999) <= 30) return 'OPENING_DRIVE';
    return 'TREND_CONTINUATION';
  }

  private fallbackPromotable(input: ContinuationPromotionInput, classification: string): boolean {
    if (classification === 'SECOND_LEG_ACCEPTANCE'
      && (input.continuationAcceptance === 'WEAK_ACCEPTANCE' || input.continuationAcceptance === 'NEUTRAL_ACCEPTANCE')) {
      return true;
    }
    if (classification === 'INSTITUTIONAL_RECLAIM') return true;
    if (classification === 'TREND_DIGESTION' && (input.trendAlignment ?? 0) >= 55) return true;
    return this.healthy.score(input) >= 55;
  }

  private resolvePromotedDecision(
    original: LiveExecutionDecision,
    classification: string,
    archetype?: ContinuationArchetypeStats
  ): LiveExecutionDecision {
    const elite = archetype && isPromotableStats(archetype);
    if (classification === 'SECOND_LEG_ACCEPTANCE' && (elite || !archetype)) return 'FULL_EXECUTION';
    if (classification === 'INSTITUTIONAL_RECLAIM' && elite) return 'FULL_EXECUTION';
    if (classification === 'HEALTHY_CONTINUATION' || classification === 'TREND_DIGESTION') {
      return elite ? 'FULL_EXECUTION' : 'PROBING_EXECUTION';
    }
    if (classification === 'CONTROLLED_PULLBACK') return 'PROBING_EXECUTION';
    if (original === 'AVOID_CHASE' || original === 'AVOID_TRADE') return 'PROBING_EXECUTION';
    return 'FULL_EXECUTION';
  }

  private promotionReason(classification: string, archetype?: ContinuationArchetypeStats): string {
    if (archetype?.promotable) {
      return `${archetype.archetype}: WR ${archetype.winRate}% · avg +${archetype.avgR}R · n=${archetype.count}`;
    }
    switch (classification) {
      case 'SECOND_LEG_ACCEPTANCE': return 'Second-leg compression statistically profitable';
      case 'INSTITUTIONAL_RECLAIM': return 'VWAP reclaim persistence supports FULL_EXECUTION';
      case 'TREND_DIGESTION': return 'Healthy continuation digestion detected';
      case 'CONTROLLED_PULLBACK': return 'Controlled pullback — not exhaustion';
      default: return 'Trend persistence intact despite weak acceptance';
    }
  }
}
