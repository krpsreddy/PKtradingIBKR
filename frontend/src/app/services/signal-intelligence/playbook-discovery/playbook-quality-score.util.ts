import { PlaybookCandidate } from './playbook-candidate.models';

export function computePlaybookQualityScore(c: {
  expectancyR: number;
  stability: number;
  sampleCount: number;
  continuationStrength: number;
  avgMae: number;
  uniqueSymbols: number;
  fakeoutRate: number;
}): number {
  const expScore = clamp((c.expectancyR + 0.2) * 35, 0, 25);
  const sampleScore = clamp((Math.min(c.sampleCount, 120) / 120) * 20, 0, 20);
  const stabScore = clamp(c.stability * 0.15, 0, 15);
  const contScore = clamp(c.continuationStrength * 0.12, 0, 12);
  const maeScore = clamp((1 - Math.abs(c.avgMae) / 1.2) * 10, 0, 10);
  const symScore = clamp(Math.min(c.uniqueSymbols, 8) / 8 * 10, 0, 10);
  const fakeoutScore = clamp((1 - c.fakeoutRate / 100) * 8, 0, 8);
  return Math.round(clamp(expScore + sampleScore + stabScore + contScore + maeScore + symScore + fakeoutScore, 0, 100));
}

export function confidenceBand(sampleCount: number): import('./playbook-candidate.models').PlaybookConfidenceBand {
  if (sampleCount < 10) return 'IGNORE';
  if (sampleCount < 25) return 'EXPERIMENTAL';
  if (sampleCount < 60) return 'DEVELOPING';
  return 'STABLE';
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
