import { Injectable } from '@angular/core';
import { ExecutionGuidance } from '../../models/execution.model';
import {
  ExecutionPlan,
  ExecutionPlanBuildContext,
  ExecutionPlanBuildResult,
  ExecutionPlanGuidance
} from '../execution-plan/execution-plan.models';
import { TemplateRegistryService } from './template-registry.service';
import { TemplateSelectorEngine } from './template-selector.engine';
import { TemplateEntryEngine } from './template-entry.engine';
import { TemplateStopEngine } from './template-stop.engine';
import { TemplateTargetEngine } from './template-target.engine';
import { TemplateAddEngine } from './template-add.engine';
import { TemplateInvalidationEngine } from './template-invalidation.engine';
import { TemplateExitEngine } from './template-exit.engine';

/** Phase 175 — assembles regime-native ExecutionPlan (AUTONOMOUS_TEMPLATE). */
@Injectable({ providedIn: 'root' })
export class AutonomousTemplatePlanEngine {
  constructor(
    private registry: TemplateRegistryService,
    private selector: TemplateSelectorEngine,
    private entryEngine: TemplateEntryEngine,
    private stopEngine: TemplateStopEngine,
    private targetEngine: TemplateTargetEngine,
    private addEngine: TemplateAddEngine,
    private invalidationEngine: TemplateInvalidationEngine,
    private exitEngine: TemplateExitEngine
  ) {}

  build(ctx: ExecutionPlanBuildContext): ExecutionPlanBuildResult {
    const tctx = this.selector.buildContext(ctx);
    if (!tctx) return { plan: null, guidance: null };

    const def = this.registry.get(tctx.regime);
    const entry = this.entryEngine.compute(tctx, def);
    const stop = this.stopEngine.compute(tctx, def, entry);
    const invalidation = this.invalidationEngine.compute(tctx, def, stop);
    const target = this.targetEngine.compute(tctx, def, entry, stop);
    const adds = this.addEngine.compute(tctx, def, entry);
    const exit = this.exitEngine.compute(tctx, def);

    const ideal = entry.ideal;
    const risk = Math.max(0.01, Math.abs(ideal - invalidation.level));
    const reward = Math.abs((target.primary ?? tctx.price) - ideal);
    const riskReward = risk > 0 ? Math.round((reward / risk) * 10) / 10 : undefined;

    const planGuidance = buildAutonomousGuidance(tctx, def, entry, stop, target, invalidation, adds, exit);

    const plan: ExecutionPlan = {
      source: 'AUTONOMOUS_TEMPLATE',
      canonicalRegime: tctx.regime,
      clusterId: tctx.clusterFamily?.primaryClusterId ?? undefined,
      lifecycleState: tctx.lifecycle,
      direction: tctx.direction,
      entryZone: { low: entry.low, high: entry.high, ideal: entry.ideal },
      stopZone: { price: stop.price, invalidation: invalidation.level },
      targetZone: {
        primary: target.primary,
        secondary: target.secondary,
        trailing: target.trailing
      },
      riskReward,
      conviction: tctx.metrics.conviction,
      expansionProbability: tctx.metrics.expansionProbability,
      continuationPersistence: tctx.metrics.continuationPersistence,
      exhaustionRisk: tctx.metrics.exhaustionProbability,
      addLevels: adds.levels.length ? adds.levels : undefined,
      executionTemplate: def.templateId,
      reasoning: buildReasoning(tctx, def, entry, target),
      guidance: planGuidance,
      metadata: {
        extended: tctx.metrics.extended,
        chartTargetPrice: target.secondary ?? target.primary,
        templateEntryStyle: entry.style,
        templateStopStyle: stop.style,
        targetProjection: target.projectionLabel,
        adaptiveMultiple: target.adaptiveMultiple,
        replayTimestamp: ctx.replayTimestamp ?? null
      }
    };

    const guidance = guidanceAdapter(plan, planGuidance);
    return { plan, guidance };
  }
}

function buildAutonomousGuidance(
  tctx: import('./autonomous-template.models').AutonomousTemplateContext,
  def: import('./autonomous-template.models').RegimeTemplateDefinition,
  entry: import('./autonomous-template.models').TemplateEntryResult,
  stop: import('./autonomous-template.models').TemplateStopResult,
  target: import('./autonomous-template.models').TemplateTargetResult,
  invalidation: import('./autonomous-template.models').TemplateInvalidationResult,
  adds: import('./autonomous-template.models').TemplateAddResult,
  exit: import('./autonomous-template.models').TemplateExitResult
): ExecutionPlanGuidance {
  const warnings: string[] = [];
  if (!def.allowsEntry) warnings.push('NO NEW ENTRY — exhaustion regime');
  if (tctx.metrics.extended) warnings.push('Extended move — reduced participation');
  if (tctx.metrics.exhaustionProbability >= 55) warnings.push('Exhaustion elevated');
  if (exit.trimBias) warnings.push('Trim bias active');

  return {
    warnings,
    invalidations: invalidation.rules,
    exhaustionNotes: tctx.metrics.exhaustionProbability >= 45
      ? [`Exhaustion ${tctx.metrics.exhaustionProbability}%`]
      : [],
    addLogic: adds.labels,
    persistenceNotes: tctx.metrics.continuationPersistence
      ? [`Persistence ${tctx.metrics.continuationPersistence}%`]
      : [],
    coaching: [def.entryStyle, def.stopStyle, def.targetStyle],
    whyNow: tctx.scannerCard?.whyNow?.slice(0, 3) ?? [],
    entryQuality: def.allowsEntry ? (entry.aggressive ? 'GOOD' : 'GOOD') : 'LATE',
    tradeQuality: Math.round(tctx.metrics.executionQuality),
    suggestedDirection: tctx.direction === 'LONG' ? 'CALLS' : 'PUTS',
    exitLabel: exit.exitLabel
  };
}

function buildReasoning(
  tctx: import('./autonomous-template.models').AutonomousTemplateContext,
  def: import('./autonomous-template.models').RegimeTemplateDefinition,
  entry: import('./autonomous-template.models').TemplateEntryResult,
  target: import('./autonomous-template.models').TemplateTargetResult
): string[] {
  return [
    `${def.displayName} template`,
    entry.style,
    target.projectionLabel
  ].slice(0, 4);
}

function guidanceAdapter(plan: ExecutionPlan, g: ExecutionPlanGuidance): ExecutionGuidance {
  return {
    entryQuality: g.entryQuality ?? 'GOOD',
    tradeQuality: g.tradeQuality ?? 50,
    suggestedDirection: g.suggestedDirection ?? 'CALLS',
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
