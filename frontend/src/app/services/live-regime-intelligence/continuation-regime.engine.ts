import { LiveRegimeInput, LiveRegimeMetrics, LiveRegimeType } from './live-regime.models';

/** Map live features → detected regime type. */
export class ContinuationRegimeEngine {
  detect(input: LiveRegimeInput, metrics: LiveRegimeMetrics): LiveRegimeType {
    const { exhaustionProbability, expansionProbability, continuationPersistenceScore,
      accelerationIntegrity, shallowPullbackQuality, institutionalParticipationScore } = metrics;

    if (exhaustionProbability >= 72) {
      return input.extended && (input.rvol ?? 0) >= 3
        ? 'RETAIL_CHASE_EXHAUSTION'
        : 'LATE_EXHAUSTION';
    }
    if (input.marketRegime === 'CHOP' || input.marketRegime === 'CHOPPY') {
      if (continuationPersistenceScore < 45) return 'CHOP_INSTABILITY';
    }
    if (expansionProbability >= 78 && accelerationIntegrity >= 70) return 'EXPLOSIVE_CONTINUATION';
    if (accelerationIntegrity >= 65 && (input.sessionTimeMinutes ?? 999) <= 45) return 'EARLY_ACCELERATION';
    if (institutionalParticipationScore >= 62 && continuationPersistenceScore >= 60) {
      return 'INSTITUTIONAL_PERSISTENCE';
    }
    if (shallowPullbackQuality >= 62 && continuationPersistenceScore >= 55) {
      return 'SHALLOW_PULLBACK_CONTINUATION';
    }
    if ((input.vwapDistance ?? 0) >= 0 && continuationPersistenceScore >= 58) {
      return 'VWAP_ACCEPTANCE_PERSISTENCE';
    }
    if (accelerationIntegrity >= 55 && shallowPullbackQuality >= 50) {
      return 'TREND_COMPRESSION_RELEASE';
    }
    if (continuationPersistenceScore >= 50) return 'INSTITUTIONAL_PERSISTENCE';
    return 'CHOP_INSTABILITY';
  }
}
