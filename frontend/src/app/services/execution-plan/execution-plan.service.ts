import { Injectable } from '@angular/core';
import { ExecutionPlanBuilderEngine } from './execution-plan-builder.engine';
import { ExecutionPlanOverlayEngine } from './execution-plan-overlay.engine';
import { RegimeExecutionTemplateRegistry } from './regime-execution-template.registry';
import { ExecutionPlanModeService } from './execution-plan-mode.service';
import { AutonomousTemplatePlanEngine } from '../autonomous-execution-templates/autonomous-template-plan.engine';
import {
  ExecutionPlan,
  ExecutionPlanBuildContext,
  ExecutionPlanBuildResult,
  ExecutionPlanGuidance
} from './execution-plan.models';
import { ExecutionPlanComparison } from './execution-plan-comparison.models';
import { ChartExecutionLevel, ExecutionGuidance, SetupCandidate, TradeStructureOverlay } from '../../models/execution.model';
import { ProbabilisticExecutionSnapshot } from '../../models/probabilistic.model';
import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { IndicatorSnapshot } from '../../models/indicator.model';
import { syncScannerLabelsFromPlan } from './execution-plan-labels.util';
import { formatEntryZoneRange } from './execution-plan-labels.util';

const DEBUG = true;

export interface PlanAttachContext {
  priceForSymbol: (symbol: string) => number | null;
  indicatorsForSymbol?: (symbol: string) => IndicatorSnapshot | null;
}

@Injectable({ providedIn: 'root' })
export class ExecutionPlanService {
  private readonly overlay = new ExecutionPlanOverlayEngine();
  readonly templates = new RegimeExecutionTemplateRegistry();

  constructor(
    private readonly legacyBuilder: ExecutionPlanBuilderEngine,
    private readonly planMode: ExecutionPlanModeService,
    private readonly autonomousBuilder: AutonomousTemplatePlanEngine
  ) {}

  /** Active plan for chart/scanner (respects executionPlanMode flag). */
  buildExecutionPlan(ctx: ExecutionPlanBuildContext): ExecutionPlanBuildResult {
    const result = this.planMode.useAutonomous()
      ? this.autonomousBuilder.build(ctx)
      : this.legacyBuilder.build(ctx);
    if (DEBUG && result.plan) {
      this.logPlan(result.plan);
    }
    return result;
  }

  buildLegacyPlan(ctx: ExecutionPlanBuildContext): ExecutionPlanBuildResult {
    return this.legacyBuilder.build({ ...ctx, planSource: 'LEGACY_RR' });
  }

  buildAutonomousPlan(ctx: ExecutionPlanBuildContext): ExecutionPlanBuildResult {
    return this.autonomousBuilder.build({ ...ctx, planSource: 'AUTONOMOUS_TEMPLATE' });
  }

  /** Phase 175 — side-by-side legacy vs autonomous (COMPARE mode). */
  buildComparison(ctx: ExecutionPlanBuildContext): ExecutionPlanComparison {
    const legacy = this.buildLegacyPlan(ctx);
    const autonomous = this.buildAutonomousPlan(ctx);
    return {
      legacy: legacy.plan,
      autonomous: autonomous.plan,
      legacyGuidance: legacy.guidance,
      autonomousGuidance: autonomous.guidance
    };
  }

  /** Phase 173A — attach unified plans to scanner cards (replaces idealEntryZone labels). */
  attachPlansToScannerCards(
    cards: ScannerOpportunityCard[],
    attach: PlanAttachContext
  ): ScannerOpportunityCard[] {
    return cards.map(card => {
      const price = attach.priceForSymbol(card.symbol);
      if (price == null) {
        return card;
      }
      const indicators = attach.indicatorsForSymbol?.(card.symbol) ?? syntheticIndicators(price);
      const source: SetupCandidate = {
        symbol: card.symbol,
        signalType: mapSignalType(card.opportunityType),
        price,
        relativeVolume: parseRvol(card.rvolLabel),
        extended: card.opportunityType === 'LATE_STAGE_EXHAUSTION'
      };
      const { plan } = this.buildExecutionPlan({
        source,
        price,
        indicators,
        scannerCard: card,
        extended: source.extended
      });
      if (!plan) return card;
      const updated = { ...card, executionPlan: plan, entryZoneLabel: formatEntryZoneRange(plan) };
      syncScannerLabelsFromPlan(updated);
      return updated;
    });
  }

  toChartLevels(plan: ExecutionPlan | null, price: number | null): ChartExecutionLevel[] {
    return this.overlay.toChartLevels(plan, price);
  }

  toTradeStructureOverlay(
    plan: ExecutionPlan | null,
    probabilistic: ProbabilisticExecutionSnapshot | null,
    hasSetup: boolean
  ): TradeStructureOverlay | null {
    return this.overlay.toTradeStructureOverlay(plan, probabilistic, hasSetup);
  }

  /** Map plan.guidance → legacy ExecutionGuidance for panels not yet migrated. */
  guidanceFromPlan(plan: ExecutionPlan | null): ExecutionGuidance | null {
    if (!plan) return null;
    const g = plan.guidance;
    return {
      entryQuality: g.entryQuality ?? 'GOOD',
      tradeQuality: g.tradeQuality ?? 50,
      suggestedDirection: g.suggestedDirection ?? (plan.direction === 'LONG' ? 'CALLS' : 'PUTS'),
      optionStyle: '—',
      stopZone: plan.stopZone.price,
      invalidationLevel: plan.stopZone.invalidation ?? plan.stopZone.price,
      estimatedRr: plan.riskReward ?? null,
      optionsRiskLevel: 'LOW',
      warnings: g.warnings,
      entryZoneLow: plan.entryZone.low,
      entryZoneHigh: plan.entryZone.high
    };
  }

  inspectorLines(plan: ExecutionPlan | null): { label: string; value: string }[] {
    if (!plan) return [];
    const g = plan.guidance;
    return [
      { label: 'Source', value: plan.source },
      { label: 'Regime', value: plan.canonicalRegime ?? '—' },
      { label: 'Cluster', value: plan.clusterId ?? '—' },
      { label: 'Entry logic', value: `ideal $${(plan.entryZone.ideal ?? plan.entryZone.low).toFixed(2)} · band ${plan.entryZone.low.toFixed(2)}–${plan.entryZone.high.toFixed(2)}` },
      { label: 'Stop logic', value: `stop $${plan.stopZone.price.toFixed(2)} · inv $${(plan.stopZone.invalidation ?? plan.stopZone.price).toFixed(2)}` },
      { label: 'Target logic', value: `primary $${plan.targetZone.primary?.toFixed(2) ?? '—'} · chart $${String(plan.metadata?.['chartTargetPrice'] ?? '—')}` },
      { label: 'RR derivation', value: `${plan.riskReward ?? '—'} (${plan.source})` },
      { label: 'Invalidation', value: g.invalidations.join(' · ') || '—' },
      { label: 'Replay ts', value: String(plan.metadata?.['replayTimestamp'] ?? '—') },
      { label: 'Why now', value: g.whyNow.join(' · ') || '—' }
    ];
  }

  private logPlan(plan: ExecutionPlan): void {
    const ideal = plan.entryZone.ideal ?? plan.entryZone.low;
    console.debug(
      '[ExecutionPlan]',
      `source=${plan.source}`,
      `regime=${plan.canonicalRegime ?? '—'}`,
      `entry=${ideal.toFixed(2)} (${plan.entryZone.low.toFixed(2)}–${plan.entryZone.high.toFixed(2)})`,
      `stop=${plan.stopZone.price.toFixed(2)}`,
      `target=${plan.targetZone.primary?.toFixed(2) ?? '—'}`,
      `rr=${plan.riskReward ?? '—'}`
    );
  }
}

function mapSignalType(opportunity: string): string {
  if (opportunity.includes('EXHAUSTION')) return 'CONT_BUY';
  return 'CONT_BUY';
}

function parseRvol(label: string): number {
  const m = label.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : 1;
}

function syntheticIndicators(price: number): IndicatorSnapshot {
  return {
    ema9: price * 0.999,
    ema20: price * 0.995,
    ema50: price * 0.99,
    rsi: 50,
    macd: 0,
    signalLine: 0,
    vwap: price * 0.998,
    avgVolume: 1,
    relativeVolume: 1
  };
}
