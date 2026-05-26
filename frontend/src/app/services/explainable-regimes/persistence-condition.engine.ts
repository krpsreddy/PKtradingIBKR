import { LiveRegimeInput, LiveRegimeMetrics } from '../live-regime-intelligence/live-regime.models';
import { inContinuationWindow } from '../live-regime-intelligence/live-regime.util';
import { REGIME_THRESHOLDS } from './regime-threshold-engine';
import { NumericThresholdCheck } from './explainable-regime.models';

/** VWAP persistence, RVOL sustainment, continuation window requirements. */
export class PersistenceConditionEngine {
  buildChecks(input: LiveRegimeInput, metrics: LiveRegimeMetrics): {
    checks: NumericThresholdCheck[];
    logic: string[];
  } {
    const E = REGIME_THRESHOLDS.expansion;
    const V = REGIME_THRESHOLDS.velocity;
    const W = REGIME_THRESHOLDS.continuationWindow;
    const checks: NumericThresholdCheck[] = [];
    const logic: string[] = [];

    const rvol = input.rvol ?? 0;
    const rvolSustained = rvol >= V.rvolSustainedMin;
    checks.push({
      feature: 'rvol_sustained',
      formula: `rvol ≥ ${V.rvolSustainedMin} (sustainment)`,
      actual: round(rvol),
      threshold: V.rvolSustainedMin,
      operator: '>=',
      passed: rvolSustained
    });
    if (rvolSustained) logic.push(`RVOL sustainment: ${round(rvol)} ≥ ${V.rvolSustainedMin}`);

    const sessionMin = input.sessionTimeMinutes ?? null;
    const inWindow = inContinuationWindow(sessionMin ?? undefined);
    checks.push({
      feature: 'continuation_window',
      formula: `sessionMinutes ∈ [${W.startMin}, ${W.endMin}]`,
      actual: sessionMin ?? 'n/a',
      threshold: `${W.startMin}–${W.endMin}`,
      operator: 'between',
      passed: inWindow
    });
    if (inWindow) logic.push(`Continuation window active (${sessionMin ?? '?'} min)`);

    const vwap = input.vwapDistance ?? 0;
    checks.push({
      feature: 'vwap_persistence',
      formula: 'price holds above VWAP (vwapDistance ≥ 0)',
      actual: round(vwap, 4),
      threshold: 0,
      operator: '>=',
      passed: vwap >= 0
    });
    if (vwap >= 0) logic.push(`VWAP persistence: distance=${round(vwap, 4)} (≥ 0)`);

    const persistOk = metrics.continuationPersistenceScore >= E.participationPersistMin;
    checks.push({
      feature: 'continuation_persistence',
      formula: `continuationPersistenceScore ≥ ${E.participationPersistMin}`,
      actual: metrics.continuationPersistenceScore,
      threshold: E.participationPersistMin,
      operator: '>=',
      passed: persistOk
    });

    const expOk = metrics.expansionProbability >= E.participationExpMin
      || (metrics.continuationPersistenceScore >= E.participationPersistAlt
        && metrics.shallowPullbackQuality >= 55);
    checks.push({
      feature: 'participation_expansion',
      formula: `expansion ≥ ${E.participationExpMin} OR (persist≥${E.participationPersistAlt} ∧ shallow≥55)`,
      actual: metrics.expansionProbability,
      threshold: E.participationExpMin,
      operator: '>=',
      passed: expOk
    });
    if (expOk) logic.push(`Expansion path: exp=${metrics.expansionProbability}%`);

    return { checks, logic };
  }

  vwapBarsLostThreshold(): number {
    return REGIME_THRESHOLDS.expansion.vwapLostBars;
  }
}

function round(v: number, d = 1): number {
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}
