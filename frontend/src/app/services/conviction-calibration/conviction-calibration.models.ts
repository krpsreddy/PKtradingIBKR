/** Phase 169 — conviction calibration outputs. */

export type PercentileRank = 'TOP_1' | 'TOP_5' | 'TOP_10' | 'STANDARD' | 'WEAK';

export interface CalibrationInput {
  continuationIntegrity: number;
  rvolSustainment: number;
  persistenceDuration: number;
  pullbackEfficiency: number;
  accelerationIntegrity: number;
  vwapAcceptance: number;
  structureQuality: number;
  expansionProbability: number;
  exhaustionPenalty: number;
  volatilityInstability: number;
  convictionVelocity?: number;
  popVelocity?: number;
  opportunityAgeSeconds?: number;
  confidenceTimeline?: { conviction: number }[];
}

export interface CalibrationResult {
  convictionScore: number;
  urgencyScore: number;
  rarityScore: number;
  persistenceScore: number;
  confidenceStability: number;
  percentileRank: PercentileRank;
  scannerPriority: number;
  convictionVelocity: number;
  popVelocity: number;
  opportunityAge: number;
}
