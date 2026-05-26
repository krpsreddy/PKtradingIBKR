import { ClusterFamily, ClusterRegistryEntry } from './cluster-family.models';

/** Family-level aggregate scores (0–100). */
export class ClusterFamilyRankingEngine {
  buildFamilyScores(
    members: ClusterRegistryEntry[],
    avgR: number
  ): Pick<ClusterFamily, 'familyPersistence' | 'familyExpansion' | 'familyExhaustion' | 'familyRobustness' | 'familyRarity' | 'familyConfidence'> {
    if (!members.length) {
      return {
        familyPersistence: 0,
        familyExpansion: 0,
        familyExhaustion: 50,
        familyRobustness: 0,
        familyRarity: 0,
        familyConfidence: 0
      };
    }

    const n = members.reduce((s, m) => s + m.sampleCount, 0);
    const w = (m: ClusterRegistryEntry) => m.sampleCount / Math.max(1, n);

    const familyPersistence = Math.round(
      members.reduce((s, m) => s + w(m) * (m.robustness * 0.6 + m.winRate * 0.4), 0)
    );
    const familyExpansion = Math.round(
      members.reduce((s, m) => s + w(m) * Math.min(100, m.avgR * 12 + m.winRate * 0.3), 0)
    );
    const familyExhaustion = Math.round(
      members.reduce((s, m) => {
        const risk = m.riskProfile === 'HIGH' ? 75 : m.riskProfile === 'ELEVATED' ? 55 : 25;
        return s + w(m) * risk;
      }, 0)
    );
    const familyRobustness = Math.round(
      members.reduce((s, m) => s + w(m) * m.robustness, 0)
    );
    const familyRarity = Math.round(
      Math.min(100, (members.length <= 2 ? 70 : 40) + avgR * 8)
    );
    const confTier = (c: string) =>
      c === 'HIGH' ? 90 : c === 'MODERATE' ? 72 : c === 'LOW' ? 48 : 25;
    const familyConfidence = Math.round(
      members.reduce((s, m) => s + w(m) * confTier(m.sampleCount >= 25 ? 'HIGH' : m.sampleCount >= 10 ? 'MODERATE' : 'LOW'), 0)
    );

    return {
      familyPersistence,
      familyExpansion,
      familyExhaustion,
      familyRobustness,
      familyRarity,
      familyConfidence
    };
  }

  /** Scanner ranking boost from family intelligence (internal, 0–12). */
  scannerFamilyBoost(family: ClusterFamily): number {
    return Math.round(
      family.familyExpansion * 0.04
      + family.familyPersistence * 0.03
      + family.familyRobustness * 0.02
      - family.familyExhaustion * 0.02
      + family.familyRarity * 0.01
    );
  }
}
