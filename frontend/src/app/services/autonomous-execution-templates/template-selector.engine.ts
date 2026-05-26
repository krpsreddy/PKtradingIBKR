import { Injectable } from '@angular/core';
import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';
import { AutonomousOpportunityType } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { ExecutionPlanBuildContext } from '../execution-plan/execution-plan.models';
import { AutonomousTemplateContext, AutonomousTemplateMetrics } from './autonomous-template.models';
import { ExecutionPlanDirection, ExecutionPlanLifecycleState } from '../execution-plan/execution-plan.models';
import { SetupCandidate } from '../../models/execution.model';

const BEARISH = new Set(['OPEN_FAIL', 'OPEN_FAIL_BREAK', 'RECOVERY_FAIL', 'IMBALANCE_DOWN']);

const OPPORTUNITY_REGIME: Record<AutonomousOpportunityType, CanonicalExecutionRegime> = {
  EARLY_CONTINUATION: 'EARLY_EXPANSION',
  SHALLOW_PULLBACK_CONTINUATION: 'SHALLOW_PULLBACK_CONTINUATION',
  VWAP_PERSISTENCE: 'VWAP_ACCEPTANCE',
  INSTITUTIONAL_ACCELERATION: 'INSTITUTIONAL_PERSISTENCE',
  COMPRESSION_RELEASE: 'COMPRESSION_BREAKOUT',
  TREND_RESUMPTION: 'PERSISTENT_CONTINUATION',
  LATE_STAGE_EXHAUSTION: 'EXHAUSTION_DRIFT'
};

@Injectable({ providedIn: 'root' })
export class TemplateSelectorEngine {
  resolveRegime(ctx: ExecutionPlanBuildContext): CanonicalExecutionRegime {
    const family = ctx.clusterFamily ?? ctx.autonomousOverlay?.clusterFamily ?? null;
    if (family?.canonicalRegime) return family.canonicalRegime;

    const opp = ctx.scannerCard?.opportunityType;
    if (opp && OPPORTUNITY_REGIME[opp]) return OPPORTUNITY_REGIME[opp];

    const sig = (ctx.source?.signalType ?? '').toUpperCase();
    if (sig.includes('FAIL') || sig.includes('EXHAUST')) return 'EXHAUSTION_DRIFT';
    if (sig.includes('PULL')) return 'SHALLOW_PULLBACK_CONTINUATION';
    if (sig.includes('VWAP') || sig.includes('RECLAIM')) return 'VWAP_ACCEPTANCE';
    if (sig.includes('COMPRESS')) return 'COMPRESSION_BREAKOUT';
    if (ctx.extended || ctx.source?.extended) return 'HEALTHY_EXTENSION';
    if (sig.includes('CONT') || sig.includes('MOM') || sig.includes('OPEN')) return 'EARLY_EXPANSION';
    return 'INSTITUTIONAL_PERSISTENCE';
  }

  buildContext(ctx: ExecutionPlanBuildContext): AutonomousTemplateContext | null {
    if (!ctx.source || ctx.price == null || !ctx.indicators) return null;

    const source = ctx.source;
    const price = ctx.price;
    const indicators = ctx.indicators;
    const bullish = !BEARISH.has(source.signalType);
    const direction: ExecutionPlanDirection = bullish ? 'LONG' : 'SHORT';
    const card = ctx.scannerCard;
    const family = ctx.clusterFamily ?? ctx.autonomousOverlay?.clusterFamily ?? null;

    const metrics: AutonomousTemplateMetrics = {
      price,
      conviction: card?.convictionScore
        ?? ctx.autonomousOverlay?.autonomousEntryScore
        ?? source.confidenceScore
        ?? 50,
      expansionProbability: card?.expansionProbability ?? family?.familyExpansion ?? 50,
      continuationPersistence: card?.continuationPersistence ?? family?.familyPersistence ?? 50,
      exhaustionProbability: card?.exhaustionProbability ?? family?.familyExhaustion ?? 20,
      triggerIntegrity: card?.triggerIntegrity ?? 50,
      institutionalPressure: card?.institutionalPressure ?? 50,
      executionQuality: card?.executionQuality ?? 50,
      relativeVolume: source.relativeVolume ?? indicators.relativeVolume ?? 1,
      extended: !!(ctx.extended || source.extended)
    };

    const whyNow = card?.whyNow ?? [];
    const narrativeStrength = Math.min(1, (whyNow.length * 0.25)
      + (family?.traderPromotionReason ? 0.2 : 0)
      + (metrics.continuationPersistence / 200));

    const accelerationIntegrity = Math.min(100,
      metrics.expansionProbability * 0.45
      + metrics.triggerIntegrity * 0.35
      + metrics.conviction * 0.2
    );

    return {
      source,
      price,
      indicators,
      direction,
      regime: this.resolveRegime(ctx),
      lifecycle: mapLifecycle(source, ctx),
      metrics,
      scannerCard: card,
      clusterFamily: family,
      probabilistic: ctx.probabilistic,
      narrativeStrength,
      accelerationIntegrity
    };
  }
}

function mapLifecycle(
  source: SetupCandidate,
  ctx: ExecutionPlanBuildContext
): ExecutionPlanLifecycleState {
  const maturity = ctx.probabilistic?.setupMaturity?.stage;
  if (maturity === 'CONFIRMED' || maturity === 'TRIGGERED') return 'CONFIRMED';
  if (maturity === 'BUILDING') return 'CONFIRMING';
  if (maturity === 'EXTENDED' || source.extended) return 'EXTENDED';
  if (maturity === 'WEAKENING' || maturity === 'FAILING') return 'EXHAUSTING';
  if (source.freshness === 'STALE') return 'FAILED';
  return 'DEVELOPING';
}
