export type TradeQualityGrade = 'A+' | 'A' | 'B' | 'C' | 'AVOID';
export type RrQuality = 'STRONG' | 'MEDIOCRE' | 'POOR';
export type EmergingState = 'BUILDING' | 'READYING' | 'NEAR_TRIGGER';
export type AlertPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ExecutionSnapshot {
  symbol: string;
  estimatedRr?: number | null;
  rrQuality?: RrQuality | null;
  entryPrice?: number | null;
  stopZone?: number | null;
  invalidationLevel?: number | null;
  targetPrice?: number | null;
  tradeQualityGrade?: TradeQualityGrade | null;
  tradeQualityScore?: number | null;
  deteriorationState?: string | null;
  deteriorationReasons?: string[];
  noEdge?: boolean;
  noEdgeMessage?: string | null;
  whyNotReasons?: string[];
  optionsGuidance?: string | null;
  optionsWarnings?: string[];
  alertPriority?: AlertPriority | null;
}

export interface EmergingSetup {
  symbol: string;
  state: EmergingState;
  setupType: string;
  description: string;
  relativeVolume?: number | null;
  rankScore?: number | null;
}

export interface TradeJournalEntry {
  id?: number;
  symbol: string;
  setupType?: string;
  signalType?: string;
  entryTimestamp?: string;
  entryPrice?: number | null;
  exitPrice?: number | null;
  result?: string;
  rrAchieved?: number | null;
  screenshotPath?: string;
  replayLink?: string;
  notes?: string;
  emotion?: string;
  mistakes?: string;
  lessons?: string;
  tradeQualityGrade?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExecutionQualityPoint {
  timestamp: string;
  label: string;
  score: number;
  grade?: string;
}
