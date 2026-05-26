import { LiveRegimeInput } from './live-regime.models';
import { clamp } from './live-regime.util';

/** RVOL + structure velocity persistence. */
export class VelocityPersistenceEngine {
  accelerationIntegrity(input: LiveRegimeInput): number {
    const rvol = input.rvol ?? 0;
    const structure = input.structureScore ?? input.trendAlignment ?? 0;
    let score = 30;
    if (rvol >= 4) score += 28;
    else if (rvol >= 2.5) score += 22;
    else if (rvol >= 1.8) score += 15;
    else if (rvol >= 1.3) score += 8;
    if (structure >= 70) score += 22;
    else if (structure >= 55) score += 14;
    else if (structure >= 45) score += 6;
    if ((input.continuationQuality ?? 0) >= 60) score += 12;
    if (input.extended && rvol >= 2) score += 8;
    return clamp(score);
  }

  rvolSustained(input: LiveRegimeInput): boolean {
    return (input.rvol ?? 0) >= 1.8;
  }
}
