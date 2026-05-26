import { LiveRegimeInput, LiveRegimeMetrics, LiveRegimeType } from '../live-regime-intelligence/live-regime.models';
import { REGIME_THRESHOLDS } from './regime-threshold-engine';
import { NumericThresholdCheck } from './explainable-regime.models';

/** Regime type detection with exact threshold comparisons (mirrors ContinuationRegimeEngine). */
export class TriggerConditionEngine {
  detectWithChecks(input: LiveRegimeInput, metrics: LiveRegimeMetrics): {
    regimeType: LiveRegimeType;
    checks: NumericThresholdCheck[];
    triggeredBecause: string[];
  } {
    const E = REGIME_THRESHOLDS.expansion;
    const V = REGIME_THRESHOLDS.velocity;
    const checks: NumericThresholdCheck[] = [];
    const triggered: string[] = [];

    const add = (
      feature: string,
      formula: string,
      actual: number,
      threshold: number,
      operator: NumericThresholdCheck['operator'],
      passed: boolean
    ) => {
      checks.push({ feature, formula, actual: round(actual), threshold, operator, passed });
      if (passed) triggered.push(`${feature}: ${round(actual)} ${operator} ${threshold}`);
    };

    const exhaustPass = metrics.exhaustionProbability >= E.exhaustionRegimeMin;
    add('exhaustion_regime', 'exhaustionProbability ≥ threshold → LATE/CHASE exhaust',
      metrics.exhaustionProbability, E.exhaustionRegimeMin, '>=', exhaustPass);
    if (exhaustPass) {
      const chase = !!(input.extended && (input.rvol ?? 0) >= 3);
      return {
        regimeType: chase ? 'RETAIL_CHASE_EXHAUSTION' : 'LATE_EXHAUSTION',
        checks,
        triggeredBecause: triggered
      };
    }

    const chop = input.marketRegime === 'CHOP' || input.marketRegime === 'CHOPPY';
    const chopPass = chop && metrics.continuationPersistenceScore < 45;
    add('chop_instability', 'CHOP ∧ continuationPersistence < 45',
      metrics.continuationPersistenceScore, 45, '<', chopPass);
    if (chopPass) return { regimeType: 'CHOP_INSTABILITY', checks, triggeredBecause: triggered };

    const explosive = metrics.expansionProbability >= E.explosiveExpMin
      && metrics.accelerationIntegrity >= E.explosiveAccelMin;
    add('explosive_exp', 'expansionProbability ≥ 78', metrics.expansionProbability, E.explosiveExpMin, '>=', metrics.expansionProbability >= E.explosiveExpMin);
    add('explosive_accel', 'accelerationIntegrity ≥ 70', metrics.accelerationIntegrity, E.explosiveAccelMin, '>=', metrics.accelerationIntegrity >= E.explosiveAccelMin);
    if (explosive) return { regimeType: 'EXPLOSIVE_CONTINUATION', checks, triggeredBecause: triggered };

    const early = metrics.accelerationIntegrity >= V.earlyAccelMin
      && (input.sessionTimeMinutes ?? 999) <= V.earlySessionMaxMin;
    add('early_accel', 'accelerationIntegrity ≥ 65', metrics.accelerationIntegrity, V.earlyAccelMin, '>=', metrics.accelerationIntegrity >= V.earlyAccelMin);
    add('early_session', `sessionMinutes ≤ ${V.earlySessionMaxMin}`, input.sessionTimeMinutes ?? 0, V.earlySessionMaxMin, '<=', early);
    if (early) return { regimeType: 'EARLY_ACCELERATION', checks, triggeredBecause: triggered };

    const inst = metrics.institutionalParticipationScore >= E.institutionalParticipationMin
      && metrics.continuationPersistenceScore >= E.institutionalPersistMin;
    add('institutional', 'institutionalParticipation ≥ 62 ∧ persist ≥ 60', metrics.institutionalParticipationScore, E.institutionalParticipationMin, '>=', inst);
    if (inst) return { regimeType: 'INSTITUTIONAL_PERSISTENCE', checks, triggeredBecause: triggered };

    const shallow = metrics.shallowPullbackQuality >= REGIME_THRESHOLDS.pullback.qualifiesMin
      && metrics.continuationPersistenceScore >= E.shallowPersistMin;
    add('shallow_pullback', 'shallowPullbackQuality ≥ 62 ∧ persist ≥ 55', metrics.shallowPullbackQuality, REGIME_THRESHOLDS.pullback.qualifiesMin, '>=', shallow);
    if (shallow) return { regimeType: 'SHALLOW_PULLBACK_CONTINUATION', checks, triggeredBecause: triggered };

    const vwap = (input.vwapDistance ?? 0) >= 0 && metrics.continuationPersistenceScore >= E.vwapPersistMin;
    add('vwap_acceptance', 'vwapDistance ≥ 0 ∧ persist ≥ 58', metrics.continuationPersistenceScore, E.vwapPersistMin, '>=', vwap);
    if (vwap) return { regimeType: 'VWAP_ACCEPTANCE_PERSISTENCE', checks, triggeredBecause: triggered };

    const compress = metrics.accelerationIntegrity >= E.compressionAccelMin
      && metrics.shallowPullbackQuality >= E.compressionShallowMin;
    if (compress) return { regimeType: 'TREND_COMPRESSION_RELEASE', checks, triggeredBecause: triggered };

    if (metrics.continuationPersistenceScore >= 50) {
      return { regimeType: 'INSTITUTIONAL_PERSISTENCE', checks, triggeredBecause: triggered };
    }
    return { regimeType: 'CHOP_INSTABILITY', checks, triggeredBecause: triggered };
  }

  entryPromotionChecks(metrics: LiveRegimeMetrics): NumericThresholdCheck[] {
    const E = REGIME_THRESHOLDS.expansion;
    return [
      check('FULL_EXECUTION', 'expansionProbability ≥ 72 ∧ persist ≥ 65',
        metrics.expansionProbability >= E.fullExecutionExp && metrics.continuationPersistenceScore >= E.fullExecutionPersist,
        metrics.expansionProbability, E.fullExecutionExp, '>='),
      check('PROBING_EXECUTION', 'persist ≥ 58 ∧ expansion ≥ 58',
        metrics.continuationPersistenceScore >= E.probingPersist && metrics.expansionProbability >= E.probingExp,
        metrics.continuationPersistenceScore, E.probingPersist, '>=')
    ];
  }
}

function check(
  feature: string,
  formula: string,
  passed: boolean,
  actual: number,
  threshold: number,
  operator: NumericThresholdCheck['operator']
): NumericThresholdCheck {
  return { feature, formula, actual: round(actual), threshold, operator, passed };
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}
