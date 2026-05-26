import { AutonomousDiscoveryReport } from '../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { AutonomousExecutionInput } from '../signal-intelligence/autonomous-execution/autonomous-execution.models';
import {
  ClusterContributionWeights,
  ClusterFamilyOverlay,
  ClusterFamilyRegistrySnapshot,
  ClusterFamilyResearchDetail,
  formatCanonicalRegimeLabel
} from './cluster-family.models';
import { ClusterFamilySimilarityEngine } from './cluster-family-similarity.engine';

/** Live overlay — trader sees canonical regime; research gets cluster breakdown. */
export class ClusterFamilyOverlayEngine {
  private readonly similarity = new ClusterFamilySimilarityEngine();

  build(
    input: AutonomousExecutionInput,
    registry: ClusterFamilyRegistrySnapshot,
    minSimilarity = 0.42
  ): ClusterFamilyOverlay | null {
    if (!registry.families.length) return null;

    const matches: { entry: ClusterFamilyRegistrySnapshot['entries'][0]; sim: number }[] = [];
    for (const e of registry.entries) {
      if (e.deprecated) continue;
      const strat = { centroid: e.featureCentroid, avgR: e.avgR, winRate: e.winRate, sampleCount: e.sampleCount } as const;
      const sim = this.similarity.matchStrategy(input, {
        id: e.clusterId,
        name: e.clusterName,
        kind: 'EXPANSION_CLUSTER',
        conditions: [],
        sampleCount: e.sampleCount,
        winRate: e.winRate,
        avgR: e.avgR,
        avgDollar: 0,
        fakeoutPct: 0,
        continuationPct: 70,
        confidence: e.sampleCount >= 25 ? 'HIGH' : e.sampleCount >= 10 ? 'MODERATE' : 'LOW',
        featureKey: '',
        idealEntryZone: 'DIRECT_BREAKOUT',
        promotable: e.robustness >= 60,
        topSymbols: [],
        centroid: e.featureCentroid
      });
      if (sim >= minSimilarity) matches.push({ entry: e, sim });
    }

    if (!matches.length) {
      const fallback = registry.families[0];
      return this.emptyOverlay(fallback);
    }

    matches.sort((a, b) => b.sim - a.sim);
    const primary = matches[0].entry;
    const family = registry.families.find(f => f.familyId === primary.familyId) ?? registry.families[0];

    const familyMembers = matches.filter(m => m.entry.familyId === family.familyId);
    const contributions = this.buildContributions(familyMembers);

    const aggregateConvictionBoost = contributions.reduce((s, c) => s + c.convictionBoost, 0);
    const label = formatCanonicalRegimeLabel(family.canonicalRegime);

    const researchExpandable: ClusterFamilyResearchDetail = {
      derivedFrom: contributions.map(c => c.clusterName),
      confidenceContributions: contributions.map(c => ({
        clusterName: c.clusterName,
        delta: c.convictionBoost,
        reason: c.lines[0] ?? 'structural match'
      })),
      whyLines: this.buildWhyLines(contributions, family)
    };

    return {
      advisoryOnly: true,
      familyId: family.familyId,
      canonicalRegime: family.canonicalRegime,
      displayLabel: label,
      primaryClusterId: primary.clusterId,
      primaryClusterName: primary.clusterName,
      matchedClusters: contributions,
      familyPersistence: family.familyPersistence,
      familyExpansion: family.familyExpansion,
      familyExhaustion: family.familyExhaustion,
      familyRobustness: family.familyRobustness,
      familyRarity: family.familyRarity,
      familyConfidence: family.familyConfidence,
      aggregateConvictionBoost,
      traderCompactLine: `${label} · score boost +${aggregateConvictionBoost}`,
      traderPromotionReason: `${label} · family confidence ${family.familyConfidence}%`,
      researchExpandable
    };
  }

  private buildContributions(
    matches: { entry: ClusterFamilyRegistrySnapshot['entries'][0]; sim: number }[]
  ): ClusterContributionWeights[] {
    return matches.slice(0, 6).map(m => {
      const sim = m.sim;
      const id = m.entry.clusterId.replace(/\D/g, '') || m.entry.clusterName;
      const persistence = Math.round(sim * 22);
      const accel = Math.round(sim * 18);
      const shallow = Math.round(sim * 12);
      const vwap = Math.round(sim * 9);
      const exhaust = Math.round((1 - sim) * 5);
      const conviction = persistence + accel + shallow + vwap - exhaust;
      const lines: string[] = [];
      if (persistence) lines.push(`+${persistence} persistence`);
      if (accel) lines.push(`+${accel} acceleration`);
      if (shallow) lines.push(`+${shallow} shallow PB`);
      if (vwap) lines.push(`+${vwap} VWAP integrity`);
      if (exhaust) lines.push(`−${exhaust} exhaustion`);
      return {
        clusterId: m.entry.clusterId,
        clusterName: m.entry.clusterName,
        similarity: Math.round(sim * 100) / 100,
        convictionBoost: conviction,
        persistenceBoost: persistence,
        exhaustionPenalty: exhaust,
        confidenceStability: Math.round(sim * 15),
        rarityMultiplier: 1 + sim * 0.15,
        lifecycleBias: m.entry.riskProfile === 'HIGH' ? 'AVOID' : 'ENTER',
        lines
      };
    });
  }

  private buildWhyLines(
    contributions: ClusterContributionWeights[],
    family: ClusterFamilyRegistrySnapshot['families'][0]
  ): string[] {
    const lines: string[] = [];
    if (contributions.some(c => c.persistenceBoost >= 15)) lines.push('sustained RVOL');
    if (contributions.some(c => c.lines.some(l => l.includes('shallow')))) lines.push('shallow PB');
    if (contributions.some(c => c.lines.some(l => l.includes('VWAP')))) lines.push('VWAP hold');
    if (contributions.some(c => c.lines.some(l => l.includes('acceleration')))) {
      lines.push('acceleration integrity');
    }
    if (!lines.length) lines.push(`${family.displayLabel} family match`);
    return lines;
  }

  private emptyOverlay(family: ClusterFamilyRegistrySnapshot['families'][0]): ClusterFamilyOverlay {
    const label = formatCanonicalRegimeLabel(family.canonicalRegime);
    return {
      advisoryOnly: true,
      familyId: family.familyId,
      canonicalRegime: family.canonicalRegime,
      displayLabel: label,
      primaryClusterId: null,
      primaryClusterName: null,
      matchedClusters: [],
      familyPersistence: family.familyPersistence,
      familyExpansion: family.familyExpansion,
      familyExhaustion: family.familyExhaustion,
      familyRobustness: family.familyRobustness,
      familyRarity: family.familyRarity,
      familyConfidence: family.familyConfidence,
      aggregateConvictionBoost: 0,
      traderCompactLine: label,
      traderPromotionReason: label,
      researchExpandable: { derivedFrom: [], confidenceContributions: [], whyLines: [] }
    };
  }
}
