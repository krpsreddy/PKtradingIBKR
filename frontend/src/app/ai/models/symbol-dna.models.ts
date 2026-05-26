/** Phase 136 — Symbol DNA profile (execution refinement, advisory only). */

import {
  BucketEdgeStats,
  RegimeEdgeStats,
  SetupEdgeStats
} from './symbol-edge.models';

export type DnaConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export type FakeoutTendency = 'LOW' | 'MODERATE' | 'HIGH';

export type EdgeScoreBand = 'FAVORABLE' | 'SELECTIVE' | 'REDUCE_SIZE' | 'AVOID';

export interface SymbolDnaProfile {
  symbol: string;
  personality: string;
  edgeScore: number;
  edgeScoreBand: EdgeScoreBand;
  continuationQuality: number;
  fakeoutTendency: FakeoutTendency;
  reclaimQuality: number | null;
  confidence: DnaConfidence;
  sampleCount: number;
  expectancy: number;
  winRate: number;
  bestSetups: SetupEdgeStats[];
  worstSetups: SetupEdgeStats[];
  timingBehavior: BucketEdgeStats[];
  regimeBehavior: RegimeEdgeStats[];
  preferredConditions: string[];
  avoidConditions: string[];
}

export function dnaConfidenceFromSamples(n: number): DnaConfidence {
  if (n >= 30) return 'HIGH';
  if (n >= 10) return 'MEDIUM';
  return 'LOW';
}

export function edgeScoreBandFromScore(score: number): EdgeScoreBand {
  if (score >= 65) return 'FAVORABLE';
  if (score >= 50) return 'SELECTIVE';
  if (score >= 35) return 'REDUCE_SIZE';
  return 'AVOID';
}
