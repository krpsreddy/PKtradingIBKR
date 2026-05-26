import { ExecutionPlan } from '../execution-plan/execution-plan.models';

/** Phase 165 — canonical autonomous opportunity taxonomy (replaces legacy MOM_BUY / BREAKOUT labels). */
export type AutonomousOpportunityType =
  | 'EARLY_CONTINUATION'
  | 'SHALLOW_PULLBACK_CONTINUATION'
  | 'VWAP_PERSISTENCE'
  | 'INSTITUTIONAL_ACCELERATION'
  | 'COMPRESSION_RELEASE'
  | 'TREND_RESUMPTION'
  | 'LATE_STAGE_EXHAUSTION';

export type AutonomousTraderAction = 'ENTER' | 'WATCH' | 'ADD' | 'AVOID' | 'EXIT';

export type ScannerCardTone = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export type ScannerSectionId =
  | 'HIGH_CONTINUATION'
  | 'EARLY_EXPANSION'
  | 'INSTITUTIONAL_PERSISTENCE'
  | 'HEALTHY_PULLBACK'
  | 'COMPRESSION_BREAKOUT'
  | 'EXHAUSTION_AVOID';

export interface ScannerOpportunityCard {
  symbol: string;
  opportunityType: AutonomousOpportunityType;
  action: AutonomousTraderAction;
  tone: ScannerCardTone;
  badge: string;
  convictionScore: number;
  expansionProbability: number;
  continuationPersistence: number;
  triggerIntegrity: number;
  institutionalPressure: number;
  exhaustionProbability: number;
  executionQuality: number;
  entryZoneLabel: string;
  riskLabel: string;
  whyNow: string[];
  windowLabel: string;
  rvolLabel: string;
  popVelocity: number;
  isRising: boolean;
  rank: number;
  /** Phase 173 — unified execution levels (replaces idealEntryZone math). */
  executionPlan?: ExecutionPlan;
}

export interface ScannerSnapshot {
  advisoryOnly: true;
  generatedAt: number;
  symbolCount: number;
  topOpportunities: ScannerOpportunityCard[];
  highContinuation: ScannerOpportunityCard[];
  earlyExpansion: ScannerOpportunityCard[];
  institutionalPersistence: ScannerOpportunityCard[];
  healthyPullback: ScannerOpportunityCard[];
  compressionBreakout: ScannerOpportunityCard[];
  exhaustionAvoid: ScannerOpportunityCard[];
  risingSymbols: string[];
  summaryInsights: string[];
}

export interface SymbolScannerState {
  symbol: string;
  lastConviction: number;
  lastScanAt: number;
  popVelocity: number;
  alertFired: boolean;
}

export interface ScannerAlert {
  symbol: string;
  message: string;
  convictionDelta: number;
  at: number;
}
