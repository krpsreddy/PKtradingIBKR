import { ReplaySignalEvent } from '../../models/replay.model';
import { TradingSignal } from '../../models/signal.model';

export type EntryDecisionType =
  | 'FULL_EXECUTION'
  | 'PROBING_EXECUTION'
  | 'WAIT_FOR_PULLBACK'
  | 'AVOID_TRADE'
  | 'TRAP_RISK'
  | 'REDUCE_SIZE'
  | 'CONTINUATION_BUY'
  | 'VWAP_RECLAIM_BUY'
  | 'SECOND_LEG_BUY'
  | 'DIGESTION_BREAKOUT'
  | 'TREND_ACCEPTANCE_BUY'
  | 'PULLBACK_HOLD_ENTRY'
  | 'ADD_ON_RECLAIM'
  | 'OPENING_DRIVE_BUY'
  | 'EARLY_EXPANSION_BUY'
  | 'INSTITUTIONAL_IMBALANCE_BUY'
  | 'TREND_DAY_INITIATION'
  | 'FIRST_PULLBACK_BUY'
  | 'OPENING_ACCEPTANCE_BUY'
  | 'CONTINUATION_ADD'
  | 'EARLY_EXPANSION_ENTRY'
  | 'VWAP_ACCEPTANCE_CONTINUATION'
  | 'SHALLOW_PULLBACK_CONTINUATION'
  | 'HIGH_RVOL_CONTINUATION'
  | 'PERSISTENCE_ENTRY'
  | 'STRUCTURE_ACCELERATION_ENTRY';

export type ExitDecisionType =
  | 'EXIT'
  | 'STOP'
  | 'TARGET'
  | 'TRAIL'
  | 'BREAKDOWN'
  | 'NARRATIVE_FAIL';

export type ReplayContextMode =
  | 'INTRADAY_ONLY'
  | 'PREVIOUS_DAY'
  | 'THREE_DAY_CONTEXT'
  | 'WEEK_CONTEXT';

export type ReplayStudyMode = 'PLAYBACK' | 'STUDY' | 'TRAINING';

export type SessionHealthStatus =
  | 'READY'
  | 'PARTIAL'
  | 'STALE'
  | 'REPLAYING'
  | 'NO_SIGNALS'
  | 'CACHE_ONLY';

export interface ReplaySessionSummary {
  sessionDate: string;
  signalCount: number;
  convictionAvg: number | null;
  replayReady: boolean;
  stale: boolean;
  bestDecision: string | null;
  bestNarrative: string | null;
  expectancy: number | null;
  status: SessionHealthStatus | string;
}

export interface EntryDecisionOverlay {
  type: EntryDecisionType;
  compactLabel: string;
  fullLabel: string;
  convictionPct: number;
  rationale: string;
  markerText: string;
  markerColor: string;
  shape: 'arrowUp' | 'circle';
  position: 'belowBar' | 'aboveBar';
  /** Phase 155 — continuation promotion metadata. */
  promoted?: boolean;
  originalDecision?: string;
  continuationEntryType?: string;
  promotionReason?: string;
  expectedR?: string | null;
  /** Phase 156 — opening expansion metadata. */
  openingExpansion?: boolean;
  openingEntryType?: string;
  openingParticipationMode?: string;
  /** Phase 159 — continuation participation metadata. */
  continuationParticipation?: boolean;
  participationSignalType?: string;
  /** Phase 160 — autonomous execution metadata. */
  autonomousExecution?: boolean;
  autonomousEntryType?: string;
  /** Phase 162 — live regime metadata. */
  liveRegime?: boolean;
  liveRegimeClassification?: string;
  /** Phase 163 — execution trigger metadata. */
  executionTrigger?: boolean;
  triggerEntryType?: string;
  triggerAction?: string;
}

export interface ExitDecisionOverlay {
  type: ExitDecisionType;
  compactLabel: string;
  markerText: string;
  markerColor: string;
  rrLabel: string | null;
  reason: string;
}

export interface ReplayDecisionTimelineRow {
  time: string;
  timeLabel: string;
  decisionLabel: string;
  convictionPct: number | null;
  narrativeLine: string;
  detailLine: string;
  expectedR: string | null;
  signalType: string;
  barIndex: number;
}

export interface ReplayCandleDecisionIntel {
  barIndex: number;
  timeLabel: string;
  decisionLabel: string;
  convictionPct: number | null;
  narrative: string;
  entryQuality: string;
  fakeoutRisk: string;
  expectedR: string | null;
  actualR: string | null;
}

export interface ReplaySessionReviewSummary {
  sessionLabel: string;
  sessionType: string;
  bestSetup: string;
  bestEntryTime: string | null;
  bestExitTime: string | null;
  narrativeStability: string;
  replayQuality: string;
  signalCount: number;
}

export interface ReplayNarrativeBand {
  fromBar: number;
  toBar: number;
  label: string;
  color: string;
}

export function signalToTradingSignal(e: ReplaySignalEvent, symbol: string): TradingSignal {
  return {
    symbol,
    signalType: e.signalType,
    timestamp: e.timestamp,
    price: e.price,
    rsi: null,
    lifecycleState: e.lifecycleState,
    confidenceScore: e.score ?? undefined,
    confidenceLabel: e.setupLabel ?? undefined,
    relativeVolume: e.rvol ?? undefined,
    vwap: e.vwap ?? undefined,
    signalReason: e.passedConditions?.join(' · '),
    extended: e.extended
  };
}
