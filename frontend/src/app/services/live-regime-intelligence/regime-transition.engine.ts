import { LiveRegimeInput, LiveRegimeMetrics, LiveRegimeType } from './live-regime.models';

/** Regime transition warnings — acceleration → exhaustion. */
export class RegimeTransitionEngine {
  warning(
    regimeType: LiveRegimeType,
    metrics: LiveRegimeMetrics,
    input: LiveRegimeInput
  ): string | null {
    if (metrics.exhaustionProbability >= 68 && metrics.continuationPersistenceScore >= 55) {
      return 'Persistence holding but exhaustion probability rising — tighten stops';
    }
    if (regimeType === 'RETAIL_CHASE_EXHAUSTION' || regimeType === 'LATE_EXHAUSTION') {
      return 'Late-stage exhaustion developing — avoid new acceleration adds';
    }
    if (regimeType === 'CHOP_INSTABILITY') {
      return 'Chop instability — continuation edge degraded';
    }
    if (input.extended && metrics.accelerationIntegrity < 45) {
      return 'Extension without acceleration integrity — legacy wait may be correct';
    }
    if (metrics.expansionProbability >= 70 && metrics.exhaustionProbability < 40) {
      return null;
    }
    return null;
  }

  transitionRisk(regimeType: LiveRegimeType, metrics: LiveRegimeMetrics): number {
    if (regimeType === 'LATE_EXHAUSTION' || regimeType === 'RETAIL_CHASE_EXHAUSTION') return 85;
    if (regimeType === 'CHOP_INSTABILITY') return 70;
    if (metrics.exhaustionProbability >= 60) return 55;
    return 20;
  }
}
