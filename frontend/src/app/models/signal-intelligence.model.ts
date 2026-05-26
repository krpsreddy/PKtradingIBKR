/** Signal quality intelligence — snapshot, evaluation, and aggregate analytics. */

export type SignalDirection = 'LONG' | 'SHORT';

export type IntelligenceSignalType =
  | 'BREAKOUT'
  | 'VWAP_RECLAIM'
  | 'TREND_CONTINUATION'
  | 'REVERSAL'
  | 'MOMENTUM';

export type MarketRegime =
  | 'TREND'
  | 'CHOP'
  | 'BREAKOUT'
  | 'CALM'
  | 'EXITING';

export type SignalOutcomeStatus = 'WIN' | 'LOSS' | 'NEUTRAL' | 'OPEN';

export type ExitReason = 'TARGET' | 'STOP' | 'TIMEOUT' | 'REVERSAL';

export type CaptureStage = 'READY' | 'TRIGGERED' | 'ENTERED';

/** Future AI layer — reserved, not populated yet. */
export interface AiConfidenceFields {
  aiConfidence?: number;
  fakeoutProbability?: number;
  continuationProbability?: number;
  momentumPersistence?: number;
}

export interface SignalSnapshot extends AiConfidenceFields {
  id: string;
  symbol: string;
  timestamp: number;
  timeframe: string;
  direction: SignalDirection;
  signalType: IntelligenceSignalType;
  marketRegime: MarketRegime;
  entryPrice: number;
  stopPrice: number;
  targetPrice?: number;
  riskReward?: number;
  convictionScore: number;
  rvol: number;
  trendAlignment: number;
  vwapDistance?: number;
  emaAlignment?: boolean;
  /** Minutes from US cash open (9:30 ET) when signal fired. */
  sessionTimeMinutes?: number;
  /** Realized range proxy — high-low / entry at capture. */
  volatility?: number;
  extendedEntry?: boolean;
  captureStage: CaptureStage;
  sourceSignalType?: string;
  createdAt: number;
  evaluation?: SignalEvaluation;
}

export interface SignalEvaluation {
  evaluated: boolean;
  status: SignalOutcomeStatus;
  mfe: number;
  mae: number;
  mfePercent: number;
  maePercent: number;
  mfeR: number;
  maeR: number;
  hit1R: boolean;
  hit2R: boolean;
  stoppedOut: boolean;
  targetHit: boolean;
  barsHeld: number;
  durationMinutes: number;
  maxPriceSeen: number;
  minPriceSeen: number;
  exitReason?: ExitReason;
  evaluatedAt: number;
  evaluationWindowMinutes: number;
  /** Per-window excursion snapshots (5/15/30/60 min). */
  windows?: EvaluationWindowResult[];
}

export interface EvaluationWindowResult {
  windowMinutes: number;
  mfeR: number;
  maeR: number;
  hit1R: boolean;
  hit2R: boolean;
  stoppedOut: boolean;
  status: SignalOutcomeStatus;
}

export interface SignalIntelligenceFilter {
  symbol?: string;
  regime?: MarketRegime;
  signalType?: IntelligenceSignalType;
  timeframe?: string;
  fromTs?: number;
  toTs?: number;
  captureStage?: CaptureStage;
  status?: SignalOutcomeStatus;
}

export interface RegimePerformance {
  regime: MarketRegime;
  count: number;
  winRate: number;
  hit1RRate: number;
  avgMfeR: number;
  avgMaeR: number;
}

export interface SignalTypePerformance {
  signalType: IntelligenceSignalType;
  count: number;
  winRate: number;
  hit1RRate: number;
  avgMfeR: number;
  avgMaeR: number;
  expectancyR?: number;
}

export interface SignalAnalyticsSnapshot {
  lookbackDays: number;
  totalSignals: number;
  evaluatedSignals: number;
  openSignals: number;
  winRate: number;
  lossRate: number;
  neutralRate: number;
  avgMfeR: number;
  avgMaeR: number;
  avgRR: number;
  hit1RRate: number;
  hit2RRate: number;
  expectancyR: number;
  bestRegime: RegimePerformance | null;
  worstRegime: RegimePerformance | null;
  bestSignalType: SignalTypePerformance | null;
  worstSignalType: SignalTypePerformance | null;
  byRegime: RegimePerformance[];
  bySignalType: SignalTypePerformance[];
  computedAt: number;
}

export const EVALUATION_WINDOWS_MINUTES = [5, 15, 30, 60] as const;
export const DEFAULT_EVALUATION_WINDOW_MINUTES = 60;
export const SIGNAL_INTELLIGENCE_LOOKBACK_DAYS = 60;
export const SIGNAL_INTELLIGENCE_STORAGE_KEY = 'pk-signal-intelligence-v1';

// ── Phase 127: Edge intelligence ────────────────────────────────────────────

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface ConfidenceRating {
  level: ConfidenceLevel;
  sampleCount: number;
  label: string;
}

export interface SetupConfidenceRating {
  signalType: IntelligenceSignalType;
  winRate: number;
  confidence: ConfidenceRating;
}

export interface ExpectancyRow {
  key: string;
  label: string;
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  confidence: ConfidenceRating;
}

export interface AgingWindowMetrics {
  windowMinutes: number;
  winRate: number;
  expectancyR: number;
  hit1RRate: number;
  lossRate: number;
  sampleCount: number;
}

export interface SetupAgingProfile {
  signalType: IntelligenceSignalType;
  windows: AgingWindowMetrics[];
  peakWindowMinutes: number | null;
  decayNote: string | null;
}

export interface AgingAnalyticsSnapshot {
  globalWindows: AgingWindowMetrics[];
  bySetup: SetupAgingProfile[];
  strongestEarlySetup: IntelligenceSignalType | null;
  persistenceSetup: IntelligenceSignalType | null;
  summaryInsight: string | null;
}

export type FailureFactorId =
  | 'CHOP_REGIME'
  | 'LOW_RVOL'
  | 'WEAK_EMA'
  | 'EXTENDED_ENTRY'
  | 'WEAK_TREND'
  | 'LOW_CONVICTION'
  | 'LATE_ENTRY'
  | 'FAILED_CONTINUATION';

export interface FailureFactorStat {
  id: FailureFactorId;
  label: string;
  lossCount: number;
  lossRate: number;
  sampleCount: number;
  confidence: ConfidenceRating;
}

export interface FactorCorrelationRow {
  factor: string;
  bucket: string;
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  avgMfeR: number;
  avgMaeR: number;
  confidence: ConfidenceRating;
}

/** Deterministic training row — no AI inference. */
export interface AITrainingFeature {
  signalId: string;
  signalType: IntelligenceSignalType;
  marketRegime: MarketRegime;
  entryPrice: number;
  stopPrice: number;
  rvol: number;
  emaAlignment: boolean;
  vwapDistance: number;
  trendAlignment: number;
  convictionScore: number;
  timeframe: string;
  volatility: number;
  sessionTimeMinutes: number;
  mfeR: number;
  maeR: number;
  hit1R: boolean;
  hit2R: boolean;
  failed: boolean;
  expectancyOutcome: number;
  captureStage: CaptureStage;
}

/** Placeholder scores — never used for live entries. */
export interface AIConfidencePlaceholder {
  signalId: string;
  fakeoutProbability: null;
  continuationProbability: null;
  exhaustionProbability: null;
  momentumPersistenceScore: null;
  note: string;
}

export interface SignalEdgeIntelligenceSnapshot extends SignalAnalyticsSnapshot {
  globalConfidence: ConfidenceRating;
  setupRatings: SetupConfidenceRating[];
  regimeExpectancy: ExpectancyRow[];
  setupExpectancy: ExpectancyRow[];
  timeframeExpectancy: ExpectancyRow[];
  aging: AgingAnalyticsSnapshot;
  failureFactors: FailureFactorStat[];
  factorCorrelations: FactorCorrelationRow[];
  fastestFailuresLabel: string | null;
  executionInsights: string[];
  trainingFeatureCount: number;
  setupRegimeMatrix: SetupRegimeMatrixSnapshot;
  falseBreakout: FalseBreakoutSnapshot;
  openingDrive: OpeningDriveSnapshot;
  edgeGate: EdgeActivationGateSnapshot;
}

// ── Phase 134: Setup×Regime matrix, fakeout, opening drive, edge gate ────────

export interface SetupRegimeMatrixCell {
  setup: IntelligenceSignalType;
  regime: MarketRegime;
  timeWindow: string;
  rvolBucket: string;
  label: string;
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  avgMfeR: number;
  avgMaeR: number;
  hit1RRate: number;
  hit2RRate: number;
  confidence: ConfidenceRating;
  /** Positive / negative / neutral for UI coloring. */
  edgeTone: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface SetupRegimeMatrixSnapshot {
  cells: SetupRegimeMatrixCell[];
  /** Setup × regime pivot (time/RVOL aggregated). */
  pivot: SetupRegimePivotCell[];
  bestCombinations: SetupRegimeMatrixCell[];
  worstCombinations: SetupRegimeMatrixCell[];
  unstableCombinations: SetupRegimeMatrixCell[];
  minSample: number;
}

export interface SetupRegimePivotCell {
  setup: IntelligenceSignalType;
  regime: MarketRegime;
  sampleCount: number;
  winRate: number;
  expectancyR: number;
  edgeTone: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export type TrapRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FalseBreakoutRegimeStat {
  regime: MarketRegime;
  sampleCount: number;
  falseBreakoutRate: number;
}

export interface FalseBreakoutRvolStat {
  bucket: string;
  sampleCount: number;
  falseBreakoutRate: number;
}

export interface FalseBreakoutTimeStat {
  window: string;
  sampleCount: number;
  falseBreakoutRate: number;
}

export interface FalseBreakoutSnapshot {
  breakoutSampleCount: number;
  falseBreakoutRate: number;
  avgReversalBars: number;
  avgReversalMinutes: number;
  fakeoutScore: number;
  trapRisk: TrapRiskLevel;
  continuationQuality: number;
  label: string;
  byRegime: FalseBreakoutRegimeStat[];
  byRvol: FalseBreakoutRvolStat[];
  byTimeOfDay: FalseBreakoutTimeStat[];
  reversalWindowBars: number;
}

export type OpeningDriveType =
  | 'OPEN_DRIVE_STRONG'
  | 'WAIT_FIRST_PULLBACK'
  | 'LIKELY_GAP_FADE'
  | 'HIGH_OPENING_TRAP_RISK'
  | 'OPENING_RECLAIM'
  | 'LIQUIDITY_SWEEP'
  | 'TREND_ACCEPTANCE'
  | 'TREND_REJECTION'
  | 'NEUTRAL';

export interface OpeningDriveSnapshot {
  openingDriveType: OpeningDriveType;
  continuationProbability: number;
  fadeProbability: number;
  firstPullbackQuality: number;
  label: string;
  sampleCount: number;
  openingWindowMinutes: number;
}

export interface OpeningDriveContext {
  symbol: string;
  signalType?: string | null;
  marketRegime?: string | null;
  rvol?: number | null;
  vwapDistance?: number | null;
  trendAlignment?: number | null;
  sessionTimeMinutes?: number | null;
  volatility?: number | null;
  regimeAligned?: boolean;
}

export type EdgeGateState =
  | 'EDGE_ACTIVE'
  | 'NO_EDGE'
  | 'OBSERVE_ONLY'
  | 'REDUCE_SIZE'
  | 'LOW_CONFIDENCE'
  | 'WAIT_FOR_CONFIRMATION';

export interface EdgeActivationGateSnapshot {
  state: EdgeGateState;
  label: string;
  reasons: string[];
  expectancyR: number;
  sampleCount: number;
  regimeAligned: boolean;
  fakeoutAcceptable: boolean;
  setupStable: boolean;
  advisoryOnly: true;
}
