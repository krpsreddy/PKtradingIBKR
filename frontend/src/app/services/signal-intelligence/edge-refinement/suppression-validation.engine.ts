import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals } from '../signal-intelligence.math';
import {
  SuppressionRuleDef,
  SuppressionSimulationResult,
  SuppressionVerdict
} from './suppression-validation.models';
import {
  computeDeltas,
  computePerformanceMetrics,
  computeSuppressionQualityScore
} from './suppression-metrics.util';
import { applyCompositeSuppression } from './suppression-rules.util';

/** Simulate removing dangerous conditions — deterministic, analytics only. */
export class SuppressionValidationEngine {

  simulateRule(signals: SignalSnapshot[], rule: SuppressionRuleDef, mode: 'REMOVE_MATCH' | 'KEEP_MATCH' = 'REMOVE_MATCH'): SuppressionSimulationResult {
    const baseline = computePerformanceMetrics(signals);
    const remaining = mode === 'KEEP_MATCH'
      ? signals.filter(s => rule.matches(s))
      : signals.filter(s => !rule.matches(s));
    const removed = signals.filter(s =>
      mode === 'KEEP_MATCH' ? !rule.matches(s) : rule.matches(s)
    );
    return this.buildResult(rule, baseline, remaining, removed);
  }

  simulateComposite(
    signals: SignalSnapshot[],
    ruleIds: string[],
    label: string,
    presetId?: import('./suppression-validation.models').SimulationPresetId
  ): SuppressionSimulationResult {
    const baseline = computePerformanceMetrics(signals);
    const remaining = applyCompositeSuppression(signals, ruleIds, presetId);
    const remainingIds = new Set(remaining.map(s => s.id));
    const removed = signals.filter(s => !remainingIds.has(s.id));

    const pseudoRule: SuppressionRuleDef = {
      id: presetId ?? 'COMPOSITE',
      label,
      category: 'COMPOSITE',
      description: 'Composite simulation preset',
      matches: () => false
    };
    return this.buildResult(pseudoRule, baseline, remaining, removed);
  }

  simulateAllRules(signals: SignalSnapshot[], rules: SuppressionRuleDef[]): SuppressionSimulationResult[] {
    return rules
      .map(rule => {
        const mode = rule.category === 'ACCEPTANCE' ? 'KEEP_MATCH' as const : 'REMOVE_MATCH' as const;
        return this.simulateRule(signals, rule, mode);
      })
      .filter(r => r.baseline.sampleCount >= 5)
      .sort((a, b) => b.qualityScore - a.qualityScore || b.deltas.expectancyR - a.deltas.expectancyR);
  }

  private buildResult(
    rule: SuppressionRuleDef,
    baseline: ReturnType<typeof computePerformanceMetrics>,
    remaining: SignalSnapshot[],
    removed: SignalSnapshot[]
  ): SuppressionSimulationResult {
    const suppressed = computePerformanceMetrics(remaining);
    const deltas = computeDeltas(baseline, suppressed, removed);
    const removedEval = evaluatedSignals(removed);
    const removedWinners = removedEval.filter(s => s.evaluation!.status === 'WIN').length;
    const removedLosers = removedEval.filter(s => s.evaluation!.status === 'LOSS').length;
    const winnerRatio = removedEval.length ? removedWinners / removedEval.length : 0;
    const overSuppressed =
      removedWinners >= 5
      && winnerRatio >= 0.35
      && deltas.missedExpectancyR > 0.15
      && deltas.expectancyR < 0.1;

    const qualityScore = computeSuppressionQualityScore(deltas, baseline, overSuppressed);
    const verdict = this.verdict(baseline, deltas, overSuppressed, qualityScore);

    return {
      ruleId: rule.id,
      ruleLabel: rule.label,
      category: rule.category,
      verdict,
      qualityScore,
      baseline,
      suppressed,
      deltas,
      removedCount: removedEval.length,
      removedWinners,
      removedLosers,
      overSuppressed,
      advisoryNote: this.advisoryNote(rule, deltas, verdict, overSuppressed),
      advisoryOnly: true
    };
  }

  private verdict(
    baseline: ReturnType<typeof computePerformanceMetrics>,
    deltas: ReturnType<typeof computeDeltas>,
    overSuppressed: boolean,
    qualityScore: number
  ): SuppressionVerdict {
    if (baseline.sampleCount < 10) return 'INSUFFICIENT_DATA';
    if (overSuppressed) return 'OVER_SUPPRESSED';
    if (deltas.expectancyR < -0.05) return 'HARMFUL';
    if (qualityScore >= 65 && deltas.expectancyR > 0.08) return 'RECOMMENDED';
    if (qualityScore >= 45 && deltas.expectancyR > 0) return 'MARGINAL';
    return 'MARGINAL';
  }

  private advisoryNote(
    rule: SuppressionRuleDef,
    deltas: ReturnType<typeof computeDeltas>,
    verdict: SuppressionVerdict,
    overSuppressed: boolean
  ): string {
    const exp = deltas.expectancyR >= 0 ? `+${deltas.expectancyR.toFixed(2)}` : deltas.expectancyR.toFixed(2);
    if (verdict === 'INSUFFICIENT_DATA') return 'Need more evaluated samples before validating this filter.';
    if (overSuppressed) {
      return `${rule.label} removes ${deltas.missedWinners} winners (+${deltas.missedExpectancyR.toFixed(2)}R missed) — over-suppressed.`;
    }
    if (verdict === 'RECOMMENDED') {
      return `${rule.label} improves expectancy by ${exp}R with ${Math.abs(deltas.fakeoutRate).toFixed(1)}% fakeout change.`;
    }
    if (verdict === 'HARMFUL') {
      return `${rule.label} reduces edge — do not apply.`;
    }
    return `${rule.label}: marginal ${exp}R improvement — review trade reduction (${deltas.tradeCountPct.toFixed(0)}%).`;
  }
}
