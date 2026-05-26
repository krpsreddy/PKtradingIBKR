import { IntelligenceFields } from './workspace.model';

export type EntryQuality = 'EARLY' | 'GOOD' | 'LATE' | 'CHASING';
export type AttentionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type OptionsDirection = 'CALLS' | 'PUTS' | 'NONE';
export type DeteriorationState = 'STABLE' | 'WEAKENING' | 'FAILING';

export interface SetupCandidate extends IntelligenceFields {
  symbol: string;
  signalType: string;
  price?: number | null;
  relativeVolume?: number | null;
  lifecycleState?: string | null;
  confidenceScore?: number | null;
  confidenceLabel?: string | null;
  timestamp?: string | null;
  regimeAligned?: boolean;
}

export interface ExecutionGuidance {
  entryQuality: EntryQuality;
  tradeQuality: number;
  suggestedDirection: OptionsDirection;
  optionStyle: string;
  stopZone: number | null;
  invalidationLevel: number | null;
  estimatedRr: number | null;
  optionsRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  warnings: string[];
  entryZoneLow: number | null;
  entryZoneHigh: number | null;
}

export interface ChartExecutionLevel {
  price: number;
  label: string;
  color: string;
  lineStyle?: number;
  zone?: 'entry' | 'stop' | 'target' | 'invalid' | 'session';
}

export interface TradeStructureOverlay {
  active: boolean;
  entryLow: number;
  entryHigh: number;
  stopZone: number;
  targetZone: number;
  invalidation: number;
  rr: number | null;
  failurePct: number | null;
  statusLabel: string;
  maturityStage: string | null;
}

export type SetupMaturityStage =
  | 'FORMING' | 'BUILDING' | 'TRIGGERED' | 'CONFIRMED'
  | 'EXTENDED' | 'WEAKENING' | 'FAILING';

export interface SetupMaturity {
  stage: SetupMaturityStage;
  label: string;
  score: number;
}

export interface SetupDeterioration {
  state: DeteriorationState;
  reasons: string[];
}

export interface ContextEmphasis {
  glowMultiplier: number;
  rankBoost: number;
  deemphasize: boolean;
  cssClass: string;
}
