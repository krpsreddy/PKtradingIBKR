import {
  CalibrationInput,
  CalibrationResult,
  PercentileRank
} from './conviction-calibration.models';
import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';
import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Phase 169 — spreads conviction scores and produces urgency/rarity/persistence outputs. */
export class ConvictionCalibrationEngine {
  /** Calibrate a single opportunity from dimension inputs. */
  calibrate(input: CalibrationInput): CalibrationResult {
    const exhaustionInverse = 100 - input.exhaustionPenalty;
    const base =
      input.continuationIntegrity * 0.14 +
      input.rvolSustainment * 0.12 +
      input.persistenceDuration * 0.10 +
      input.pullbackEfficiency * 0.08 +
      input.accelerationIntegrity * 0.10 +
      input.vwapAcceptance * 0.10 +
      input.structureQuality * 0.12 +
      input.expansionProbability * 0.14 +
      exhaustionInverse * 0.10 -
      input.volatilityInstability * 0.08;

    const highDims = [
      input.continuationIntegrity,
      input.rvolSustainment,
      input.structureQuality,
      input.expansionProbability
    ].filter(v => v >= 80).length;

    const rarityScore = clamp(Math.round(40 + highDims * 14 + (input.expansionProbability > 85 ? 8 : 0)));
    const persistenceScore = clamp(Math.round(input.persistenceDuration * 0.55 + input.rvolSustainment * 0.25));
    const velocity = input.convictionVelocity ?? 0;
    const pop = input.popVelocity ?? 0;

    const rarityMultiplier = 1 + (rarityScore - 50) / 200;
    const persistenceMultiplier = 1 + (persistenceScore - 45) / 180;
    const velocityMultiplier = 1 + Math.max(0, velocity) / 120 + Math.max(0, pop) / 200;

    let raw = base * rarityMultiplier * persistenceMultiplier * velocityMultiplier;

    // Anti-spike dampener — velocity without persistence
    if (velocity >= 12 && input.persistenceDuration < 35) {
      raw *= 0.88;
    }

    // Confidence decay from timeline variance
    const stability = this.confidenceStability(input.confidenceTimeline);
    const decay = 1 - (100 - stability) / 400;
    raw *= decay;

    const urgencyScore = clamp(Math.round(
      raw * 0.35 +
      Math.max(0, velocity) * 1.2 +
      Math.max(0, pop) * 0.8 +
      (input.expansionProbability > 75 ? 12 : 0)
    ));

    const convictionScore = clamp(Math.round(raw));
    const age = input.opportunityAgeSeconds ?? 0;

    return {
      convictionScore,
      urgencyScore,
      rarityScore,
      persistenceScore,
      confidenceStability: stability,
      percentileRank: 'STANDARD',
      scannerPriority: urgencyScore + convictionScore * 0.4,
      convictionVelocity: velocity,
      popVelocity: pop,
      opportunityAge: age
    };
  }

  /** Spread scores across cohort to avoid 67–72 clustering. */
  calibrateCohort(inputs: CalibrationInput[]): CalibrationResult[] {
    const raw = inputs.map(i => this.calibrate(i));
    const sorted = [...raw].sort((a, b) => b.scannerPriority - a.scannerPriority);
    const n = sorted.length;
    const spreadBands = [98, 95, 92, 88, 85, 82, 78, 72, 68, 65];

    return raw.map((r, idx) => {
      const rankIdx = sorted.indexOf(r);
      const pct = n <= 1 ? 0 : rankIdx / (n - 1);
      const bandIdx = Math.min(spreadBands.length - 1, Math.floor(pct * spreadBands.length));
      const spreadScore = spreadBands[bandIdx];
      const blended = clamp(Math.round(r.convictionScore * 0.35 + spreadScore * 0.65));

      return {
        ...r,
        convictionScore: blended,
        percentileRank: this.percentileFromRank(rankIdx, n),
        scannerPriority: blended + r.urgencyScore * 0.35 + Math.max(0, r.convictionVelocity) * 1.5
      };
    });
  }

  fromScannerCard(card: ScannerOpportunityCard): CalibrationInput {
    return {
      continuationIntegrity: card.continuationPersistence,
      rvolSustainment: card.institutionalPressure,
      persistenceDuration: card.continuationPersistence,
      pullbackEfficiency: card.executionQuality,
      accelerationIntegrity: card.expansionProbability,
      vwapAcceptance: card.triggerIntegrity,
      structureQuality: card.triggerIntegrity,
      expansionProbability: card.expansionProbability,
      exhaustionPenalty: card.exhaustionProbability,
      volatilityInstability: Math.max(0, 100 - card.executionQuality),
      popVelocity: card.popVelocity,
      convictionVelocity: card.isRising ? 14 : 0
    };
  }

  fromFeedItem(item: ExecutionFeedItem): CalibrationInput {
    const timeline = item.confidenceTimeline ?? [];
    const age = item.persistenceSeconds;
    return {
      continuationIntegrity: item.triggerIntegrity,
      rvolSustainment: item.expansionProbability,
      persistenceDuration: clamp(age * 3 + item.triggerIntegrity * 0.4),
      pullbackEfficiency: item.triggerIntegrity,
      accelerationIntegrity: item.expansionProbability,
      vwapAcceptance: item.triggerIntegrity,
      structureQuality: item.triggerIntegrity,
      expansionProbability: item.expansionProbability,
      exhaustionPenalty: item.maturityState === 'EXHAUSTING' ? 85 : item.maturityState === 'FAILED' ? 95 : 20,
      volatilityInstability: item.preConfirmation ? 35 : 15,
      convictionVelocity: item.convictionVelocity,
      popVelocity: item.convictionVelocity >= 8 ? item.convictionVelocity : 0,
      opportunityAgeSeconds: age,
      confidenceTimeline: timeline
    };
  }

  percentileLabel(rank: PercentileRank): string {
    switch (rank) {
      case 'TOP_1': return 'TOP 1%';
      case 'TOP_5': return 'TOP 5%';
      case 'TOP_10': return 'TOP 10%';
      case 'WEAK': return 'WEAK';
      default: return 'STANDARD';
    }
  }

  private percentileFromRank(rankIdx: number, n: number): PercentileRank {
    if (n <= 1) return 'TOP_1';
    const pct = rankIdx / n;
    if (pct <= 0.01) return 'TOP_1';
    if (pct <= 0.05) return 'TOP_5';
    if (pct <= 0.10) return 'TOP_10';
    if (pct >= 0.75) return 'WEAK';
    return 'STANDARD';
  }

  private confidenceStability(timeline?: { conviction: number }[]): number {
    if (!timeline || timeline.length < 2) return 72;
    const vals = timeline.map(t => t.conviction);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length;
    return clamp(Math.round(100 - Math.sqrt(variance) * 2.5));
  }
}

export const convictionCalibrationEngine = new ConvictionCalibrationEngine();
