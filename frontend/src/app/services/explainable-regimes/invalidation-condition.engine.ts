import { LiveRegimeInput, LiveRegimeMetrics } from '../live-regime-intelligence/live-regime.models';
import { REGIME_THRESHOLDS } from './regime-threshold-engine';
import { NumericThresholdCheck } from './explainable-regime.models';

/** Exact invalidation rules — when entry must not promote. */
export class InvalidationConditionEngine {
  buildChecks(input: LiveRegimeInput, metrics: LiveRegimeMetrics): {
    checks: NumericThresholdCheck[];
    rules: string[];
    invalidated: boolean;
  } {
    const E = REGIME_THRESHOLDS.expansion;
    const P = REGIME_THRESHOLDS.pullback;
    const checks: NumericThresholdCheck[] = [];
    const rules: string[] = [];

    const add = (c: NumericThresholdCheck, rule: string) => {
      checks.push(c);
      if (!c.passed) rules.push(rule);
    };

    const exhaustBlock = metrics.exhaustionProbability >= E.blockExhaustionMin
      && metrics.continuationPersistenceScore < E.blockOverlayPersistMax;
    add({
      feature: 'exhaustion_overlay_block',
      formula: `exhaustion ≥ ${E.blockOverlayExhaustion} ∧ persist < ${E.blockOverlayPersistMax}`,
      actual: metrics.exhaustionProbability,
      threshold: E.blockOverlayExhaustion,
      operator: '>=',
      passed: !exhaustBlock
    }, `Invalidates if exhaustion ≥ ${E.blockOverlayExhaustion} AND persist < ${E.blockOverlayPersistMax}`);

    add({
      feature: 'participation_exhaustion',
      formula: `exhaustionProbability < ${E.blockExhaustionMin} for participation`,
      actual: metrics.exhaustionProbability,
      threshold: E.blockExhaustionMin,
      operator: '<',
      passed: metrics.exhaustionProbability < E.blockExhaustionMin
    }, `Invalidates if exhaustion ≥ ${E.blockExhaustionMin}`);

    const depth = input.pullbackDepth ?? Math.abs(input.vwapDistance ?? 0);
    add({
      feature: 'pullback_depth',
      formula: `pullbackDepth ≤ ${(P.invalidationPullbackMax * 100).toFixed(0)}%`,
      actual: round(depth * 100, 1),
      threshold: P.invalidationPullbackMax * 100,
      operator: '<=',
      passed: depth <= P.invalidationPullbackMax,
      unit: '%'
    }, `Invalidates if pullback depth > ${P.invalidationPullbackMax * 100}%`);

    add({
      feature: 'acceleration_integrity',
      formula: `accelerationIntegrity ≥ ${E.invalidationIntegrityMin}`,
      actual: metrics.accelerationIntegrity,
      threshold: E.invalidationIntegrityMin,
      operator: '>=',
      passed: metrics.accelerationIntegrity >= E.invalidationIntegrityMin
    }, `Invalidates if acceleration integrity < ${E.invalidationIntegrityMin}`);

    add({
      feature: 'vwap_lost',
      formula: `VWAP lost for > ${E.vwapLostBars} bars`,
      actual: input.vwapDistance ?? 0,
      threshold: 0,
      operator: '>=',
      passed: (input.vwapDistance ?? -1) >= 0
    }, `Invalidates if VWAP lost for > ${E.vwapLostBars} bars`);

    add({
      feature: 'exhaustion_score_high',
      formula: `exhaustionProbability ≤ ${E.invalidationExhaustion}`,
      actual: metrics.exhaustionProbability,
      threshold: E.invalidationExhaustion,
      operator: '<=',
      passed: metrics.exhaustionProbability <= E.invalidationExhaustion
    }, `Invalidates if exhaustion score > ${E.invalidationExhaustion}`);

    const invalidated = checks.some(c => !c.passed && c.feature !== 'vwap_lost');
    return { checks, rules, invalidated };
  }
}

function round(v: number, d = 1): number {
  const m = Math.pow(10, d);
  return Math.round(v * m) / m;
}
