import {
  DiscoveredStrategy,
  IdealEntryZoneKind,
  PreExpansionFeatureVector
} from '../signal-intelligence/autonomous-discovery/autonomous-discovery.models';

/** Phase 171 — canonical execution regime (trader-facing). */
export type CanonicalExecutionRegime =
  | 'EARLY_EXPANSION'
  | 'INSTITUTIONAL_PERSISTENCE'
  | 'VWAP_ACCEPTANCE'
  | 'SHALLOW_PULLBACK_CONTINUATION'
  | 'COMPRESSION_BREAKOUT'
  | 'HEALTHY_EXTENSION'
  | 'EXHAUSTION_DRIFT'
  | 'PERSISTENT_CONTINUATION';

export type ClusterBehaviorType =
  | 'EXPANSION'
  | 'CONTINUATION'
  | 'PERSISTENCE'
  | 'EXHAUSTION'
  | 'TRAP';

export type ClusterFamilyLifecycleBias = 'ENTER' | 'ADD' | 'WATCH' | 'AVOID' | 'EXIT';

/** Registry row — one discovered micro-cluster. */
export interface ClusterRegistryEntry {
  clusterId: string;
  clusterName: string;
  familyId: string;
  canonicalRegime: CanonicalExecutionRegime;
  description: string;
  behaviorType: ClusterBehaviorType;
  featureCentroid?: PreExpansionFeatureVector;
  avgR: number;
  robustness: number;
  sampleCount: number;
  winRate: number;
  failureModes: string[];
  bestSessionWindows: string[];
  riskProfile: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';
  idealEntryZone: IdealEntryZoneKind;
  deprecated: boolean;
}

/** Aggregated family — trader UX primary grouping. */
export interface ClusterFamily {
  familyId: string;
  canonicalRegime: CanonicalExecutionRegime;
  displayLabel: string;
  description: string;
  behaviorType: ClusterBehaviorType;
  memberClusterIds: string[];
  memberClusterNames: string[];
  avgR: number;
  robustness: number;
  sampleCount: number;
  winRate: number;
  familyPersistence: number;
  familyExpansion: number;
  familyExhaustion: number;
  familyRobustness: number;
  familyRarity: number;
  familyConfidence: number;
  lifecycleBias: ClusterFamilyLifecycleBias;
  failureModes: string[];
  bestSessionWindows: string[];
}

export interface ClusterContributionWeights {
  clusterId: string;
  clusterName: string;
  similarity: number;
  convictionBoost: number;
  persistenceBoost: number;
  exhaustionPenalty: number;
  confidenceStability: number;
  rarityMultiplier: number;
  lifecycleBias: ClusterFamilyLifecycleBias;
  lines: string[];
}

export interface ClusterFamilyOverlay {
  advisoryOnly: true;
  familyId: string;
  canonicalRegime: CanonicalExecutionRegime;
  displayLabel: string;
  primaryClusterId: string | null;
  primaryClusterName: string | null;
  matchedClusters: ClusterContributionWeights[];
  familyPersistence: number;
  familyExpansion: number;
  familyExhaustion: number;
  familyRobustness: number;
  familyRarity: number;
  familyConfidence: number;
  aggregateConvictionBoost: number;
  traderCompactLine: string;
  traderPromotionReason: string;
  researchExpandable: ClusterFamilyResearchDetail;
}

export interface ClusterFamilyResearchDetail {
  derivedFrom: string[];
  confidenceContributions: { clusterName: string; delta: number; reason: string }[];
  whyLines: string[];
}

export interface ClusterFamilyRegistrySnapshot {
  advisoryOnly: true;
  generatedAt: number;
  clusterCount: number;
  familyCount: number;
  entries: ClusterRegistryEntry[];
  families: ClusterFamily[];
}

export const CANONICAL_REGIME_LABELS: Record<CanonicalExecutionRegime, string> = {
  EARLY_EXPANSION: 'Early Expansion',
  INSTITUTIONAL_PERSISTENCE: 'Institutional Persistence',
  VWAP_ACCEPTANCE: 'VWAP Acceptance',
  SHALLOW_PULLBACK_CONTINUATION: 'Healthy Pullback Continuation',
  COMPRESSION_BREAKOUT: 'Compression Breakout',
  HEALTHY_EXTENSION: 'Healthy Extension',
  EXHAUSTION_DRIFT: 'Exhaustion Drift',
  PERSISTENT_CONTINUATION: 'Persistent Continuation'
};

export function formatCanonicalRegimeLabel(regime: CanonicalExecutionRegime): string {
  return CANONICAL_REGIME_LABELS[regime] ?? regime.replace(/_/g, ' ');
}
