import { LiveRegimeInput } from './live-regime.models';
import { clamp } from './live-regime.util';

/** Continuation persistence — core Phase 162 discovery. */
export class PersistenceDetectionEngine {
  continuationPersistenceScore(input: LiveRegimeInput): number {
    const vwap = input.vwapDistance ?? 0;
    const rvol = input.rvol ?? 0;
    const structure = input.structureScore ?? input.trendAlignment ?? 0;
    let score = 25;

    if (vwap >= 0) score += 18;
    if (vwap >= 0.005 && vwap < 0.025) score += 12;
    if (rvol >= 2) score += 20;
    else if (rvol >= 1.5) score += 12;
    if (structure >= 60) score += 18;
    else if (structure >= 48) score += 10;
    if ((input.continuationQuality ?? 0) >= 55) score += 15;
    if (input.extended && rvol >= 2 && structure >= 55) score += 10;
    if (Math.abs(vwap) > 0.04) score -= 12;
    return clamp(score);
  }

  trendPersistenceProbability(input: LiveRegimeInput): number {
    const base = this.continuationPersistenceScore(input);
    const regimeBoost = input.marketRegime === 'TREND' ? 12 : input.marketRegime === 'BREAKOUT' ? 8 : 0;
    return clamp(base * 0.85 + regimeBoost);
  }
}
