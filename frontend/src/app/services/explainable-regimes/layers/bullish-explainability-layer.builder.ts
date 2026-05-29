import { ExplainableRegimeExplanation } from '../explainable-regime.models';
import { REGIME_FORMULAS, REGIME_THRESHOLDS } from '../regime-threshold-engine';
import {
  DiscoveredStrategy
} from '../../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { ExplainableClusterContext } from '../explainable-regime.models';
import {
  ConfidenceContributorLine,
  EngineeringTriggerLine,
  LayeredExplainability,
  LifecycleStepLine
} from './explainability-layer.models';
import {
  dedupeTriggers,
  engineeringLine,
  fromNumericCheck
} from './engineering-trigger.util';
import { RawDiscoveryStatsBuilder } from './raw-discovery-stats.builder';

/** Phase 208 — bullish layered explainability. */
export class BullishExplainabilityLayerBuilder {
  private readonly rawStats = new RawDiscoveryStatsBuilder();

  build(
    ex: ExplainableRegimeExplanation,
    strategy?: DiscoveredStrategy,
    ctx?: ExplainableClusterContext
  ): LayeredExplainability {
    const raw = ex.rawMetrics ?? {};
    const triggers = this.engineeringTriggers(ex, raw);
    const interpretation = this.structuralInterpretation(ex, raw);
    const lifecycle = this.bullishLifecycle(ex.regimeType);
    const formula = this.formulaDebug(ex);

    return {
      direction: 'BULLISH',
      clusterName: ex.strategySpec?.strategyName ?? ex.regimeLabel,
      regimeLabel: ex.regimeLabel,
      finalScore: ex.finalConviction,
      structuralSummary: this.structuralSummary(ex),
      exactTriggers: triggers,
      structuralInterpretation: interpretation,
      confidenceContributors: this.confidenceLines(ex),
      lifecycleEvolution: lifecycle,
      invalidatesIf: [...ex.exhaustionRules, ...ex.whyEntryInvalidated].filter(Boolean),
      formulaDebug: formula,
      rawDiscoveryStats: strategy ? this.rawStats.build(strategy, ctx) : [],
      triggerSequence: ex.triggerSequence.map(e => ({
        time: e.time,
        event: e.event,
        detail: e.detail ?? (e.actual != null ? `${e.actual} vs ${e.threshold}` : undefined)
      }))
    };
  }

  private structuralSummary(ex: ExplainableRegimeExplanation): string {
    const r = ex.regimeType.replace(/_/g, ' ').toLowerCase();
    if (ex.regimeType.includes('EXPLOSIVE') || ex.regimeType.includes('EARLY')) {
      return `Early acceleration continuation with strong participation and ${ex.finalConviction >= 60 ? 'healthy' : 'developing'} persistence.`;
    }
    if (ex.regimeType.includes('INSTITUTIONAL') || ex.regimeType.includes('PERSISTENCE')) {
      return `Institutional persistence regime with sustained expansion integrity (${r}).`;
    }
    if (ex.regimeType.includes('PULLBACK')) {
      return `Shallow pullback continuation holding structure with re-acceleration potential.`;
    }
    if (ex.regimeType.includes('VWAP')) {
      return `VWAP acceptance persistence — price holding institutional support zone.`;
    }
    if (ex.regimeType.includes('EXHAUST') || ex.regimeType.includes('CHASE')) {
      return `Late-stage extension — elevated exhaustion risk; participation caution.`;
    }
    return `Continuation regime classified as ${r} with conviction ${ex.finalConviction}.`;
  }

  private engineeringTriggers(
    ex: ExplainableRegimeExplanation,
    raw: Record<string, number | string | boolean>
  ): EngineeringTriggerLine[] {
    const T = REGIME_THRESHOLDS;
    const rvol = num(raw['rvol']);
    const persist = num(raw['continuationPersistenceScore']);
    const accel = num(raw['accelerationIntegrity']);
    const expansion = num(raw['expansionProbability']);
    const exhaust = num(raw['exhaustionProbability']);
    const vwap = num(raw['vwapDistance']);
    const structure = num(raw['structureScore']);
    const trend = num(raw['trendAlignment'] ?? structure);
    const session = num(raw['sessionMinutes']);

    const lines: EngineeringTriggerLine[] = [
      engineeringLine('RVOL', round(rvol), '>=', 2.0, rvol >= 2.0, 'rvol'),
      engineeringLine('AccelerationIntegrity', round(accel), '>=', 70, accel >= 70, 'acceleration_integrity'),
      engineeringLine('Persistence', round(persist), '>=', 58, persist >= 58, 'continuation_persistence'),
      engineeringLine('TrendAlignment', round(trend), '>=', 55, trend >= 55, 'trend_alignment'),
      engineeringLine('VWAPDistance', round(vwap, 4), '>=', -0.003, vwap >= -0.003, 'vwap_distance'),
      engineeringLine('ExpansionProbability', round(expansion), '>=', 55, expansion >= 55, 'expansion_probability'),
      engineeringLine('ExhaustionProbability', round(exhaust), '<=', T.expansion.invalidationExhaustion, exhaust <= T.expansion.invalidationExhaustion, 'exhaustion_probability'),
      engineeringLine('StructureScore', round(structure), '>=', T.structure.entryMin, structure >= T.structure.entryMin, 'structure_score'),
      engineeringLine('FalseBreakout', 'false', '==', 'false', true, 'false_breakout'),
      engineeringLine('SessionMinutes', round(session), '<=', T.continuationWindow.endMin, session <= T.continuationWindow.endMin, 'session_minutes')
    ];

    for (const c of ex.entryConditions) {
      lines.push(fromNumericCheck(c));
    }
    return dedupeTriggers(lines);
  }

  private structuralInterpretation(
    ex: ExplainableRegimeExplanation,
    raw: Record<string, number | string | boolean>
  ): string[] {
    const out: string[] = [];
    const persist = num(raw['continuationPersistenceScore']);
    const rvol = num(raw['rvol']);
    const session = num(raw['sessionMinutes']);

    if (rvol >= 2.5) out.push('High participation expansion confirmed.');
    else if (rvol >= 1.8) out.push('Participation above sustainment baseline.');
    if (session <= 45) out.push('Opening-session continuation window active.');
    if (persist >= 70) out.push('Persistence holding above institutional sustainment band.');
    if (ex.whyExtensionHealthy.length) {
      out.push(...ex.whyExtensionHealthy.map(s => s.replace(/^Extended but healthy:?\s*/i, 'Extension healthy: ')));
    }
    if (!out.length) {
      out.push('Structure acceptable for continuation participation per engineering gates.');
    }
    return out.slice(0, 5);
  }

  private confidenceLines(ex: ExplainableRegimeExplanation): ConfidenceContributorLine[] {
    return ex.featureContributions
      .filter(c => c.feature !== 'base' || c.delta !== ex.convictionBase)
      .map(c => ({
        label: formatContribLabel(c.feature),
        delta: c.delta,
        runningTotal: c.runningTotal
      }));
  }

  private bullishLifecycle(regimeType: string): LifecycleStepLine[] {
    const base: LifecycleStepLine[] = [{ phase: 'EARLY_ACCELERATION', detail: 'Velocity + RVOL gates engaged' }];
    if (regimeType.includes('INSTITUTIONAL') || regimeType.includes('PERSISTENCE')) {
      base.push({ phase: 'PERSISTING', detail: 'Institutional participation sustainment' });
      base.push({ phase: 'SECOND_LEG', detail: 'Second-leg expansion window' });
    } else if (regimeType.includes('PULLBACK')) {
      base.push({ phase: 'PERSISTING', detail: 'Pullback held above invalidation depth' });
      base.push({ phase: 'SECOND_LEG', detail: 'Re-acceleration from shallow pullback' });
    } else if (regimeType.includes('EXPLOSIVE') || regimeType.includes('EARLY')) {
      base.push({ phase: 'PERSISTING', detail: 'Acceleration integrity confirmed' });
    }
    if (regimeType.includes('EXHAUST') || regimeType.includes('LATE')) {
      base.push({ phase: 'EXTENDED_CONTINUATION', detail: 'Late extension — exhaustion monitoring' });
    } else {
      base.push({ phase: 'EXTENDED_CONTINUATION', detail: 'Extension phase if gates remain valid' });
    }
    return base;
  }

  private formulaDebug(ex: ExplainableRegimeExplanation) {
    const lines = ex.featureContributions.map(c => ({
      term: c.feature,
      delta: c.delta,
      note: c.formula
    }));
    return {
      headline: 'structureScore / conviction composite',
      base: ex.convictionBase,
      lines,
      formulas: { ...ex.formulas, structureScore: REGIME_FORMULAS['structureScore'] ?? '' }
    };
  }
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

function round(v: number, d = 2): number {
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}

function formatContribLabel(feature: string): string {
  const map: Record<string, string> = {
    rvol: 'RVOL',
    trend: 'Trend',
    vwap: 'VWAP',
    persist: 'Persistence',
    accel: 'Acceleration',
    extension_penalty: 'Extension penalty'
  };
  return map[feature] ?? feature.replace(/_/g, ' ');
}
