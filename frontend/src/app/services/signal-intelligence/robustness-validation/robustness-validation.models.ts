import { MarketRegime } from '../../../models/signal-intelligence.model';

export type RobustnessClassification =
  | 'ROBUST'
  | 'LIKELY_ROBUST'
  | 'REGIME_DEPENDENT'
  | 'SYMBOL_DEPENDENT'
  | 'OUTLIER_DEPENDENT'
  | 'LOW_CONFIDENCE'
  | 'OVERFIT_RISK';

export interface StrategyRobustnessRow {
  strategyId: string;
  strategyName: string;
  sampleCount: number;
  winRate: number;
  avgR: number;
  robustnessScore: number;
  generalizationScore: number;
  regimeConsistency: number;
  outlierDependency: number;
  walkforwardDecay: number;
  continuationPersistenceQuality: number;
  classification: RobustnessClassification;
  uniqueSymbols: number;
  topSymbols: string[];
  advisoryNote: string;
}

export interface RegimeBreakdownRow {
  strategyName: string;
  regime: MarketRegime | string;
  count: number;
  winRate: number;
  avgR: number;
}

export interface OutlierAnalysisRow {
  strategyName: string;
  fullSampleAvgR: number;
  trimmedAvgR: number;
  top3ContributionPct: number;
  outlierDependent: boolean;
  collapsePct: number;
}

export interface WalkforwardValidationRow {
  strategyName: string;
  trainAvgR: number;
  testAvgR: number;
  trainWinRate: number;
  testWinRate: number;
  expectancyDecay: number;
  wrDecay: number;
  stable: boolean;
}

export interface GeneralizationMetrics {
  strategyName: string;
  uniqueSymbols: number;
  uniqueSessions: number;
  symbolConcentrationPct: number;
  crossSymbolWrStdDev: number;
  generalizes: boolean;
}

export interface CrossSymbolStabilityRow {
  strategyName: string;
  symbol: string;
  count: number;
  winRate: number;
  avgR: number;
}

export interface ContinuationPersistenceRow {
  strategyName: string;
  continuationPct: number;
  hit2RPct: number;
  avgMfeR: number;
  pullbackHoldPct: number;
  stable: boolean;
}

export interface RobustnessValidationReport {
  advisoryOnly: true;
  lookbackDays: number;
  generatedAt: number;
  totalEvaluated: number;
  strategyRobustness: StrategyRobustnessRow[];
  regimeBreakdowns: RegimeBreakdownRow[];
  outlierAnalysis: OutlierAnalysisRow[];
  walkforwardValidation: WalkforwardValidationRow[];
  generalizationMetrics: GeneralizationMetrics[];
  crossSymbolStability: CrossSymbolStabilityRow[];
  continuationPersistenceStability: ContinuationPersistenceRow[];
  robustStrategies: StrategyRobustnessRow[];
  regimeDependent: StrategyRobustnessRow[];
  symbolDependent: StrategyRobustnessRow[];
  overfitRiskLeaderboard: StrategyRobustnessRow[];
  summaryInsights: string[];
}

export interface StrategyValidationMetrics {
  robustnessScore: number;
  generalizationScore: number;
  regimeConsistency: number;
  outlierDependency: number;
  walkforwardDecay: number;
  continuationPersistenceQuality: number;
  classification: RobustnessClassification;
}
