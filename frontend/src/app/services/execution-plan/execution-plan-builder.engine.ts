import { Injectable } from '@angular/core';
import { buildExecutionGuidance } from '../../utils/execution-guidance.util';
import { ExecutionGuidance, SetupCandidate } from '../../models/execution.model';
import {
  ExecutionPlan,
  ExecutionPlanBuildContext,
  ExecutionPlanBuildResult,
  ExecutionPlanDirection,
  ExecutionPlanGuidance
} from './execution-plan.models';

const BEARISH = new Set(['OPEN_FAIL', 'OPEN_FAIL_BREAK', 'RECOVERY_FAIL', 'IMBALANCE_DOWN']);

/** Wraps legacy RR math into ExecutionPlan without changing numeric outputs. */
@Injectable({ providedIn: 'root' })
export class ExecutionPlanBuilderEngine {
  build(ctx: ExecutionPlanBuildContext): ExecutionPlanBuildResult {
    const guidance = buildExecutionGuidance(ctx.source, ctx.price, ctx.indicators);
    if (!guidance || ctx.price == null || !ctx.source) {
      return { plan: null, guidance };
    }

    const price = ctx.price;
    const snap = ctx.snapshot;
    const bullish = !BEARISH.has(ctx.source.signalType);
    const direction: ExecutionPlanDirection = bullish ? 'LONG' : 'SHORT';

    const entryLow = guidance.entryZoneLow ?? price * (bullish ? 0.998 : 1.002);
    const entryHigh = guidance.entryZoneHigh ?? price * (bullish ? 1.003 : 0.997);
    const idealEntry = snap?.entryPrice ?? guidance.entryZoneLow ?? entryLow;

    const stopPrice = snap?.stopZone ?? guidance.stopZone ?? entryLow;
    const invalidation = snap?.invalidationLevel ?? guidance.invalidationLevel ?? stopPrice;

    const rr = snap?.estimatedRr ?? guidance.estimatedRr ?? undefined;

    const chartTarget =
      snap?.targetPrice ??
      (guidance.estimatedRr != null && guidance.invalidationLevel != null
        ? price + (price - guidance.invalidationLevel) * guidance.estimatedRr
        : null);

    const tradeTarget =
      snap?.targetPrice ??
      (price + (price - invalidation) * (guidance.estimatedRr ?? 2));

    const family = ctx.clusterFamily ?? ctx.autonomousOverlay?.clusterFamily ?? null;
    const canonicalRegime = family?.canonicalRegime;
    const clusterId = family?.primaryClusterId ?? ctx.autonomousOverlay?.matchedClusterId ?? undefined;

    const exitState = ctx.probabilistic?.adaptiveExit?.state;
    const exitLabel = exitState ? formatExitState(exitState) : 'HOLD';

    const planGuidance = buildPlanGuidance(guidance, ctx, exitLabel);

    const plan: ExecutionPlan = {
      source: ctx.planSource ?? 'LEGACY_RR',
      canonicalRegime,
      clusterId: clusterId ?? undefined,
      lifecycleState: mapLifecycle(ctx.source, ctx.probabilistic),
      direction,
      entryZone: {
        low: entryLow,
        high: entryHigh,
        ideal: idealEntry
      },
      stopZone: {
        price: stopPrice,
        invalidation
      },
      targetZone: {
        primary: tradeTarget,
        secondary: chartTarget ?? undefined
      },
      riskReward: rr ?? undefined,
      conviction: ctx.autonomousOverlay?.autonomousEntryScore
        ?? ctx.scannerCard?.convictionScore
        ?? ctx.source.confidenceScore
        ?? undefined,
      expansionProbability: ctx.scannerCard?.expansionProbability
        ?? family?.familyExpansion,
      continuationPersistence: ctx.scannerCard?.continuationPersistence
        ?? family?.familyPersistence,
      exhaustionRisk: ctx.scannerCard?.exhaustionProbability
        ?? family?.familyExhaustion,
      executionTemplate: canonicalRegime ?? (ctx.planSource ?? 'LEGACY_RR'),
      reasoning: buildReasoning(ctx, family?.traderPromotionReason),
      guidance: planGuidance,
      metadata: {
        extended: !!ctx.extended,
        chartTargetPrice: chartTarget,
        rrQuality: snap?.rrQuality ?? null,
        replayTimestamp: ctx.replayTimestamp ?? null
      }
    };

    return { plan, guidance };
  }
}

function buildPlanGuidance(
  guidance: ExecutionGuidance,
  ctx: ExecutionPlanBuildContext,
  exitLabel: string
): ExecutionPlanGuidance {
  const invalidations: string[] = [];
  if (guidance.invalidationLevel != null) {
    invalidations.push(`Invalidation $${guidance.invalidationLevel.toFixed(2)}`);
  }

  const exhaustionNotes: string[] = [];
  if ((ctx.scannerCard?.exhaustionProbability ?? 0) >= 55) {
    exhaustionNotes.push('Exhaustion drift elevated');
  }

  return {
    warnings: [...guidance.warnings],
    invalidations,
    exhaustionNotes,
    addLogic: [],
    persistenceNotes: ctx.scannerCard?.continuationPersistence
      ? [`Persistence ${ctx.scannerCard.continuationPersistence}%`]
      : [],
    coaching: [],
    whyNow: ctx.scannerCard?.whyNow ?? ctx.autonomousOverlay?.promotionReason
      ? [ctx.autonomousOverlay!.promotionReason, ...(ctx.scannerCard?.whyNow ?? [])].slice(0, 4)
      : [],
    entryQuality: guidance.entryQuality,
    tradeQuality: guidance.tradeQuality,
    suggestedDirection: guidance.suggestedDirection,
    exitLabel
  };
}

function formatExitState(state: string): string {
  return state.replace(/_/g, ' ');
}

function mapLifecycle(
  source: SetupCandidate,
  probabilistic?: ExecutionPlanBuildContext['probabilistic']
): ExecutionPlan['lifecycleState'] {
  const maturity = probabilistic?.setupMaturity?.stage;
  if (maturity === 'CONFIRMED' || maturity === 'TRIGGERED') return 'CONFIRMED';
  if (maturity === 'BUILDING') return 'CONFIRMING';
  if (maturity === 'EXTENDED' || source.extended) return 'EXTENDED';
  if (maturity === 'WEAKENING' || maturity === 'FAILING') return 'EXHAUSTING';
  if (source.freshness === 'STALE') return 'FAILED';
  return 'DEVELOPING';
}

function buildReasoning(
  ctx: ExecutionPlanBuildContext,
  promotionReason?: string
): string[] {
  const lines: string[] = [];
  if (promotionReason) lines.push(promotionReason);
  if (ctx.autonomousOverlay?.promotionReason) lines.push(ctx.autonomousOverlay.promotionReason);
  if (ctx.scannerCard?.whyNow?.length) lines.push(...ctx.scannerCard.whyNow.slice(0, 2));
  return lines.slice(0, 4);
}
