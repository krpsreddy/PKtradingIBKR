import { OpeningExpansionInput, OpeningExpansionQualification } from './opening-expansion.models';
import { FIRST_FIVE_MIN } from './opening-expansion.util';
import { OpeningDriveImbalanceEngine } from './opening-drive-imbalance.engine';
import { OpeningVolumeAccelerationEngine } from './opening-volume-acceleration.engine';

/** First 5-minute candle qualification for institutional expansion. */
export class EarlyExpansionQualificationEngine {
  private readonly imbalance = new OpeningDriveImbalanceEngine();
  private readonly volume = new OpeningVolumeAccelerationEngine();

  qualify(input: OpeningExpansionInput): OpeningExpansionQualification {
    const mins = input.sessionTimeMinutes ?? 999;
    const rvol = input.rvol ?? 0;
    const ext = Math.abs(input.vwapDistance ?? 0) * 100;
    const score = input.score ?? 0;
    const aboveVwap = (input.vwapDistance ?? 0) >= -0.002;
    const volAccel = this.volume.isAccelerating(input);

    let qualScore = 40;
    if (mins <= FIRST_FIVE_MIN) qualScore += 15;
    if (rvol >= 2) qualScore += 12;
    if (rvol >= 4) qualScore += 8;
    if (aboveVwap) qualScore += 10;
    if (score >= 4) qualScore += 12;
    if (volAccel) qualScore += 10;
    if (input.signalType.includes('MOM') || input.signalType === 'IMBALANCE_UP') qualScore += 10;
    if (ext > 5 && input.extended) qualScore -= 20;
    if (input.signalType.includes('FAIL')) qualScore -= 30;

    const institutional = this.imbalance.isInstitutional(input);
    const retailExhaustion = this.imbalance.isRetailExhaustion(input);

    return {
      score: Math.max(0, Math.min(100, qualScore)),
      institutional,
      retailExhaustion,
      gapContinuation: rvol >= 2.5 && aboveVwap && mins <= 15,
      orbAcceptance: aboveVwap && score >= 3 && mins <= 20,
      volumeAcceleration: volAccel,
      breadthAligned: (input.trendAlignment ?? score * 15) >= 45,
      noImmediateRejection: !retailExhaustion && !input.signalType.includes('FAIL'),
      followThroughProb: Math.min(95, qualScore + (institutional ? 12 : 0))
    };
  }
}
