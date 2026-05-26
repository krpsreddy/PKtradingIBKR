import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AutonomousDiscoveryReport, DiscoveredStrategy } from '../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import { AutonomousDiscoverySynthesisService } from '../signal-intelligence/autonomous-discovery/autonomous-discovery-synthesis.service';
import { AutonomousExecutionInput } from '../signal-intelligence/autonomous-execution/autonomous-execution.models';
import {
  CanonicalExecutionRegime,
  ClusterFamily,
  ClusterFamilyOverlay,
  ClusterFamilyRegistrySnapshot,
  ClusterRegistryEntry,
  formatCanonicalRegimeLabel
} from './cluster-family.models';
import { ClusterFamilyMapperEngine } from './cluster-family-mapper.engine';
import { ClusterFamilyRankingEngine } from './cluster-family-ranking.engine';
import { ClusterFamilyOverlayEngine } from './cluster-family-overlay.engine';
import { ClusterFamilySimilarityEngine } from './cluster-family-similarity.engine';

/** Phase 171 — cluster family registry (preserves all micro-clusters, groups for UX). */
@Injectable({ providedIn: 'root' })
export class ClusterFamilyRegistryService {
  private readonly mapper = new ClusterFamilyMapperEngine();
  private readonly ranking = new ClusterFamilyRankingEngine();
  private readonly overlayEngine = new ClusterFamilyOverlayEngine();
  private readonly similarity = new ClusterFamilySimilarityEngine();

  private readonly registrySubject = new BehaviorSubject<ClusterFamilyRegistrySnapshot | null>(null);
  readonly registry$ = this.registrySubject.asObservable();

  /** Deprecated cluster merges — clusterId → absorbed into family. */
  private readonly deprecatedClusters = new Set<string>();

  constructor(private discovery: AutonomousDiscoverySynthesisService) {
    this.discovery.report$.subscribe(r => {
      if (r) this.rebuildFromReport(r);
    });
    const snap = this.discovery.snapshot();
    if (snap) this.rebuildFromReport(snap);
  }

  snapshot(): ClusterFamilyRegistrySnapshot | null {
    return this.registrySubject.value;
  }

  rebuildFromReport(report: AutonomousDiscoveryReport): ClusterFamilyRegistrySnapshot {
    const entries: ClusterRegistryEntry[] = [];
    const byFamily = new Map<string, ClusterRegistryEntry[]>();

    for (const s of report.discoveredStrategies) {
      const regime = this.mapper.inferCanonicalRegime(s);
      const familyId = this.mapper.familyIdForRegime(regime);
      const robustness = this.robustnessScore(s);
      const entry: ClusterRegistryEntry = {
        clusterId: s.id,
        clusterName: s.name,
        familyId,
        canonicalRegime: regime,
        description: this.mapper.description(s, regime),
        behaviorType: this.mapper.behaviorType(s, regime),
        featureCentroid: s.centroid,
        avgR: s.avgR,
        robustness,
        sampleCount: s.sampleCount,
        winRate: s.winRate,
        failureModes: this.mapper.failureModes(s),
        bestSessionWindows: this.mapper.bestSessionWindows(s.centroid),
        riskProfile: this.mapper.riskProfile(s),
        idealEntryZone: s.idealEntryZone,
        deprecated: this.deprecatedClusters.has(s.id)
      };
      entries.push(entry);
      byFamily.set(familyId, [...(byFamily.get(familyId) ?? []), entry]);
    }

    this.mergeOverlappingFamilies(byFamily, report.discoveredStrategies);

    const families: ClusterFamily[] = [];
    for (const [familyId, members] of byFamily) {
      if (!members.length) continue;
      const n = members.reduce((s, m) => s + m.sampleCount, 0);
      const avgR = members.reduce((s, m) => s + m.avgR * m.sampleCount, 0) / Math.max(1, n);
      const winRate = members.reduce((s, m) => s + m.winRate * m.sampleCount, 0) / Math.max(1, n);
      const regime = members[0].canonicalRegime;
      const scores = this.ranking.buildFamilyScores(members, avgR);
      const lifecycle = this.mapper.lifecycleBias(regime, avgR);

      families.push({
        familyId,
        canonicalRegime: regime,
        displayLabel: formatCanonicalRegimeLabel(regime),
        description: `${members.length} micro-clusters · weighted ${avgR.toFixed(1)}R`,
        behaviorType: members[0].behaviorType,
        memberClusterIds: members.map(m => m.clusterId),
        memberClusterNames: members.map(m => m.clusterName),
        avgR: Math.round(avgR * 100) / 100,
        robustness: Math.round(members.reduce((s, m) => s + m.robustness, 0) / members.length),
        sampleCount: n,
        winRate: Math.round(winRate),
        lifecycleBias: lifecycle,
        failureModes: [...new Set(members.flatMap(m => m.failureModes))].slice(0, 4),
        bestSessionWindows: [...new Set(members.flatMap(m => m.bestSessionWindows))].slice(0, 3),
        ...scores
      });
    }

    families.sort((a, b) => b.avgR * b.sampleCount - a.avgR * a.sampleCount);

    const registry: ClusterFamilyRegistrySnapshot = {
      advisoryOnly: true,
      generatedAt: Date.now(),
      clusterCount: entries.length,
      familyCount: families.length,
      entries,
      families
    };
    this.registrySubject.next(registry);
    return registry;
  }

  familyForCluster(clusterId: string): ClusterFamily | null {
    const e = this.registrySubject.value?.entries.find(x => x.clusterId === clusterId || x.clusterName === clusterId);
    if (!e) return null;
    return this.registrySubject.value?.families.find(f => f.familyId === e.familyId) ?? null;
  }

  familyForStrategy(strategy: DiscoveredStrategy): ClusterFamily | null {
    return this.familyForCluster(strategy.id) ?? this.familyForCluster(strategy.name);
  }

  canonicalRegimeForCluster(clusterIdOrName: string): CanonicalExecutionRegime | null {
    const e = this.registrySubject.value?.entries.find(
      x => x.clusterId === clusterIdOrName || x.clusterName === clusterIdOrName
    );
    return e?.canonicalRegime ?? null;
  }

  buildLiveOverlay(input: AutonomousExecutionInput): ClusterFamilyOverlay | null {
    const reg = this.registrySubject.value;
    if (!reg) return null;
    return this.overlayEngine.build(input, reg);
  }

  matchClusterSimilarity(input: AutonomousExecutionInput, strategy: DiscoveredStrategy): number {
    return this.similarity.matchStrategy(input, strategy);
  }

  scannerBoostForOpportunityType(opportunityType: string): number {
    const reg = this.registrySubject.value;
    if (!reg) return 0;
    const key = opportunityType.toUpperCase();
    const family = reg.families.find(f =>
      f.canonicalRegime === key
      || f.familyId === key
      || f.displayLabel.toUpperCase().includes(key.replace(/_/g, ' '))
    );
    if (!family) {
      const mapped = this.mapOpportunityToRegime(key);
      const f2 = reg.families.find(f => f.canonicalRegime === mapped);
      return f2 ? this.ranking.scannerFamilyBoost(f2) : 0;
    }
    return this.ranking.scannerFamilyBoost(family);
  }

  /** Aggregate families for research UI (replaces 24-row spam). */
  aggregatedFamilies(): ClusterFamily[] {
    return this.registrySubject.value?.families ?? [];
  }

  deprecateCluster(clusterId: string): void {
    this.deprecatedClusters.add(clusterId);
    const snap = this.discovery.snapshot();
    if (snap) this.rebuildFromReport(snap);
  }

  private robustnessScore(s: DiscoveredStrategy): number {
    let score = 50;
    if (s.confidence === 'HIGH') score += 25;
    else if (s.confidence === 'MODERATE') score += 12;
    else if (s.confidence === 'INSUFFICIENT') score -= 20;
    if (s.sampleCount >= 25) score += 10;
    if (s.promotable) score += 8;
    if (s.fakeoutPct > 30) score -= 15;
    return Math.max(0, Math.min(100, score));
  }

  /** Merge near-duplicate centroids within same canonical regime. */
  private mergeOverlappingFamilies(
    byFamily: Map<string, ClusterRegistryEntry[]>,
    strategies: DiscoveredStrategy[]
  ): void {
    const MERGE_DIST = 0.12;
    for (const [, members] of byFamily) {
      if (members.length < 2) continue;
      const stratById = new Map(strategies.map(s => [s.id, s]));
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = stratById.get(members[i].clusterId)?.centroid;
          const b = stratById.get(members[j].clusterId)?.centroid;
          if (a && b && this.similarity.centroidDistance(a, b) < MERGE_DIST) {
            if (members[j].sampleCount < members[i].sampleCount) {
              this.deprecatedClusters.add(members[j].clusterId);
              members[j].deprecated = true;
            }
          }
        }
      }
    }
  }

  private mapOpportunityToRegime(opportunity: string): CanonicalExecutionRegime {
    if (opportunity.includes('SHALLOW') || opportunity.includes('PULLBACK')) {
      return 'SHALLOW_PULLBACK_CONTINUATION';
    }
    if (opportunity.includes('VWAP')) return 'VWAP_ACCEPTANCE';
    if (opportunity.includes('COMPRESSION')) return 'COMPRESSION_BREAKOUT';
    if (opportunity.includes('EXHAUSTION') || opportunity.includes('LATE')) return 'EXHAUSTION_DRIFT';
    if (opportunity.includes('INSTITUTIONAL') || opportunity.includes('ACCELERATION')) {
      return 'INSTITUTIONAL_PERSISTENCE';
    }
    if (opportunity.includes('EARLY') || opportunity.includes('CONTINUATION')) {
      return 'EARLY_EXPANSION';
    }
    return 'INSTITUTIONAL_PERSISTENCE';
  }
}
