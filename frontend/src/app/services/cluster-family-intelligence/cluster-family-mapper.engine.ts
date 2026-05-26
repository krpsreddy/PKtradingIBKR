import {
  DiscoveredStrategy,
  IdealEntryZoneKind,
  PreExpansionFeatureVector
} from '../signal-intelligence/autonomous-discovery/autonomous-discovery.models';
import {
  CanonicalExecutionRegime,
  ClusterBehaviorType,
  ClusterFamilyLifecycleBias,
  formatCanonicalRegimeLabel
} from './cluster-family.models';

/** Maps micro-clusters → canonical execution regime (deterministic heuristics). */
export class ClusterFamilyMapperEngine {
  inferCanonicalRegime(strategy: DiscoveredStrategy): CanonicalExecutionRegime {
    const c = strategy.centroid;
    const zone = strategy.idealEntryZone;

    if (strategy.avgR < 0 || strategy.fakeoutPct > 45) return 'EXHAUSTION_DRIFT';
    if (zone === 'PULLBACK_ENTRY' || (c && c.pullbackDepthQ <= 1 && c.vwapDistQ <= 2)) {
      return 'SHALLOW_PULLBACK_CONTINUATION';
    }
    if (zone === 'RECLAIM_ENTRY' || (c && c.vwapDistQ <= 1 && c.trendQ >= 2)) {
      return 'VWAP_ACCEPTANCE';
    }
    if (c?.extended && strategy.continuationPct >= 55 && strategy.avgR >= 1.5) {
      return 'HEALTHY_EXTENSION';
    }
    if (c && c.sessionQ <= 1 && c.rvolQ >= 3) return 'EARLY_EXPANSION';
    if (c && c.volumeAccelQ >= 3 && c.structureScore >= 55) return 'COMPRESSION_BREAKOUT';
    if (strategy.kind === 'CONTINUATION_PROFILE') return 'PERSISTENT_CONTINUATION';
    if (strategy.continuationPct >= 60 && strategy.avgR >= 2) return 'INSTITUTIONAL_PERSISTENCE';
    return 'INSTITUTIONAL_PERSISTENCE';
  }

  familyIdForRegime(regime: CanonicalExecutionRegime): string {
    return regime;
  }

  behaviorType(strategy: DiscoveredStrategy, regime: CanonicalExecutionRegime): ClusterBehaviorType {
    if (regime === 'EXHAUSTION_DRIFT') return 'EXHAUSTION';
    if (regime === 'COMPRESSION_BREAKOUT') return 'EXPANSION';
    if (strategy.kind === 'PERSISTENCE_PATTERN') return 'PERSISTENCE';
    if (strategy.fakeoutPct > 30) return 'TRAP';
    return 'CONTINUATION';
  }

  lifecycleBias(regime: CanonicalExecutionRegime, avgR: number): ClusterFamilyLifecycleBias {
    if (regime === 'EXHAUSTION_DRIFT') return 'AVOID';
    if (avgR >= 2) return 'ENTER';
    if (avgR >= 1) return 'ADD';
    return 'WATCH';
  }

  riskProfile(strategy: DiscoveredStrategy): 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' {
    if (strategy.fakeoutPct >= 35) return 'HIGH';
    if (strategy.confidence === 'INSUFFICIENT') return 'ELEVATED';
    if (strategy.confidence === 'LOW') return 'MODERATE';
    return 'LOW';
  }

  bestSessionWindows(c?: PreExpansionFeatureVector): string[] {
    if (!c) return ['9:35–11:00'];
    if (c.sessionQ <= 1) return ['9:35–9:45 opening', '9:45–10:15 early expansion'];
    if (c.sessionQ <= 2) return ['9:45–10:15', '10:15–11:00'];
    return ['10:15–11:00 persistence', 'midday'];
  }

  failureModes(strategy: DiscoveredStrategy): string[] {
    const modes: string[] = [];
    if (strategy.fakeoutPct >= 25) modes.push(`fakeout ${strategy.fakeoutPct}%`);
    if (strategy.centroid?.extended) modes.push('late extension chase');
    if (strategy.sampleCount < 10) modes.push('low sample (n<10)');
    return modes.length ? modes : ['chop invalidation'];
  }

  description(strategy: DiscoveredStrategy, regime: CanonicalExecutionRegime): string {
    return `${formatCanonicalRegimeLabel(regime)} archetype · ${strategy.sampleCount} samples · avg ${strategy.avgR.toFixed(1)}R`;
  }
}
