import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';
import { MarketConditionTag } from '../execution-template-validation/execution-template-validation.models';

export type ExitValidationMode = 'LEGACY_RR' | 'AUTONOMOUS_TEMPLATE' | 'HYBRID';

export type ClusterKind = 'CANONICAL' | 'RAW_CLUSTER';

export interface ExitPathAnalytics {
  exitBarIndex: number;
  exitReason: 'STOP' | 'TARGET' | 'TIMEOUT' | 'OPEN';
  exitR: number;
  peakMfeR: number;
  retainedMfePct: number;
  missedMfeR: number;
  missedMfePct: number;
  postExitBars: number;
  postExitContinuationR: number;
  postExitContinuationPct: boolean;
  secondLegCaptured: boolean;
  rvolSustainedAfterExit: boolean;
  persistenceIntactAfterExit: boolean;
  vwapHealthyAfterExit: boolean;
  falseExhaustion: boolean;
  exhaustionWhilePersistence: boolean;
  overTightTarget: boolean;
  underExtendedTarget: boolean;
  earlyTrim: boolean;
  exitToPeakDistanceR: number;
  targetHit: boolean;
  persistenceOverrideWouldHelp: boolean;
}

export interface ExitOutcomeSample {
  mode: ExitValidationMode;
  symbol: string;
  sessionDate: string;
  regime: CanonicalExecutionRegime;
  clusterId: string;
  clusterLabel: string;
  clusterKind: ClusterKind;
  marketTags: MarketConditionTag[];
  signalType: string;
  extended: boolean;
  plannedRr: number | null;
  planPersistence: number;
  planExhaustion: number;
  exitLabel: string | null;
  path: ExitPathAnalytics;
}

export interface ExitModeAggregate {
  mode: ExitValidationMode;
  sampleCount: number;
  exitQualityScore: number;
  avgRetainedMfePct: number;
  avgMissedMfePct: number;
  postExitContinuationPct: number;
  avgPostExitBars: number;
  secondLegCapturePct: number;
  falseExhaustionPct: number;
  exhaustionWhilePersistencePct: number;
  targetEfficiencyPct: number;
  overTightTargetPct: number;
  underExtendedTargetPct: number;
  earlyTrimPct: number;
  avgExitToPeakDistanceR: number;
  persistenceOverrideSavedPct: number;
  expectancyProxy: number;
}

export interface RegimeExitComparison {
  regime: CanonicalExecutionRegime;
  legacy: ExitModeAggregate;
  autonomous: ExitModeAggregate;
  hybrid: ExitModeAggregate;
  winner: ExitValidationMode | 'TIE';
  exitQualityDelta: number;
  sampleCount: number;
}

export interface ClusterExitRow {
  clusterId: string;
  clusterLabel: string;
  clusterKind: ClusterKind;
  canonicalRegime: CanonicalExecutionRegime;
  mode: ExitValidationMode;
  aggregate: ExitModeAggregate;
}

export interface ExitLeaderboardRow {
  label: string;
  score: number;
  sampleCount: number;
  detail: string;
}

export interface ExitHybridRoutingSuggestion {
  regime: CanonicalExecutionRegime;
  clusterHint?: string;
  entrySource: string;
  exitStrategy: string;
  targetStrategy: string;
  persistenceOverride: boolean;
  reason: string;
}

export interface ExitIntelligenceValidationReport {
  advisoryOnly: true;
  researchOnly: true;
  generatedAt: number;
  lookbackDays: number;
  sessionsScanned: number;
  eventsEvaluated: number;
  symbolsScanned: number;
  clustersEvaluated: number;
  overallExitQualityScore: number;
  overallLegacy: ExitModeAggregate;
  overallAutonomous: ExitModeAggregate;
  overallHybrid: ExitModeAggregate;
  overallWinner: ExitValidationMode | 'TIE';
  regimeComparisons: RegimeExitComparison[];
  clusterRows: ClusterExitRow[];
  bestExitRegimes: ExitLeaderboardRow[];
  worstExitRegimes: ExitLeaderboardRow[];
  mostPrematureExits: ExitLeaderboardRow[];
  mostUnderCapturedContinuations: ExitLeaderboardRow[];
  bestSecondLegHolders: ExitLeaderboardRow[];
  falseExhaustionLeaderboard: ExitLeaderboardRow[];
  persistenceOverrideSavedRanking: ExitLeaderboardRow[];
  topClustersNeedingTargetExtension: ExitLeaderboardRow[];
  hybridRoutingSuggestions: ExitHybridRoutingSuggestion[];
  summaryInsights: string[];
  insufficientSample: boolean;
  validationWarnings: string[];
}

export interface ExitValidationProgress {
  phase: string;
  done: number;
  total: number;
}
