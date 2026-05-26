import { ConfidenceRating } from '../../../models/signal-intelligence.model';

/** Phase 146 — adaptive entry optimization (advisory only). */

export type EntryWindow =
  | 'INSTANT_RECLAIM'
  | 'RECLAIM_HOLD'
  | 'PULLBACK_STABILIZATION'
  | 'SECOND_LEG_TRIGGER'
  | 'POST_ACCEPTANCE_CONTINUATION'
  | 'INSTANT_BREAKOUT'
  | 'FIRST_PUSH';

export type EntryLocationType =
  | 'IDEAL_LOCATION'
  | 'EARLY_ACCEPTANCE'
  | 'LATE_ACCEPTANCE'
  | 'EXTENDED_LOCATION'
  | 'EXHAUSTED_LOCATION'
  | 'TRAP_LOCATION'
  | 'INSTITUTIONAL_LOCATION';

export type EntryStyle = 'AGGRESSIVE' | 'PATIENT';

export type InstitutionalTimingPattern =
  | 'ABSORPTION_PULLBACK'
  | 'SECOND_LEG_ACCEPTANCE'
  | 'RECLAIM_HOLD'
  | 'OPEN_DRIVE_TRAP'
  | 'POST_ACCEPTANCE_CONTINUATION';

export interface EntryWindowMetrics {
  window: EntryWindow;
  label: string;
  sampleCount: number;
  expectancyR: number;
  continuationRate: number;
  fakeoutRate: number;
  avgMaeR: number;
  missedExpansionPct: number;
  confidence: ConfidenceRating;
}

export interface EntryLocationMetrics {
  location: EntryLocationType;
  label: string;
  sampleCount: number;
  expectancyR: number;
  fakeoutRate: number;
  continuationRate: number;
  verdict: 'BEST' | 'DANGEROUS' | 'NEUTRAL';
  confidence: ConfidenceRating;
}

export interface AggressiveVsPatientRow {
  style: EntryStyle;
  sampleCount: number;
  expectancyR: number;
  fakeoutRate: number;
  continuationSurvival: number;
  expansionCapturePct: number;
  missedWinners: number;
  confidence: ConfidenceRating;
}

export interface MissedExpansionRow {
  waitStrategy: string;
  sampleCount: number;
  fakeoutReductionPct: number;
  missedExpansionPct: number;
  expectancyGainR: number;
  note: string;
}

export interface InstitutionalTimingInsight {
  pattern: InstitutionalTimingPattern;
  label: string;
  sampleCount: number;
  expectancyR: number;
  note: string;
}

export interface NarrativeEntryEfficiencyRow {
  signalId: string;
  narrativePath: string;
  entryLocation: EntryLocationType;
  capturePct: number;
  narrativeMfeR: number;
  entryMfeR: number;
}

export interface PlaybookEntryZone {
  playbookId: string;
  playbookLabel: string;
  bestEntries: string[];
  avoidEntries: string[];
}

export interface LiveAdaptiveEntryInput {
  symbol: string;
  signalType?: string;
  marketRegime?: string;
  sessionTimeMinutes?: number;
  vwapDistance?: number;
  extended?: boolean;
  entryQuality?: string | null;
  trendAlignment?: number;
  rvol?: number;
  sequencingState?: string;
  marketState?: string;
  narrativeTrajectory?: string;
  sampleCount?: number;
}

export interface LiveAdaptiveEntryIntel {
  entryLocation: EntryLocationType;
  locationLabel: string;
  entryWindow: EntryWindow;
  windowLabel: string;
  guidanceLine: string;
  compactLine: string;
  efficiencyPct: number | null;
  optimalWindowHint: string | null;
  styleRecommendation: EntryStyle | null;
  detailLines: string[];
  authoritative: boolean;
  advisoryOnly: true;
}

export interface AdaptiveEntryReport {
  lookbackDays: number;
  totalEvaluated: number;
  bestEntryLocations: EntryLocationMetrics[];
  dangerousEntryLocations: EntryLocationMetrics[];
  entryWindows: EntryWindowMetrics[];
  aggressiveVsPatient: AggressiveVsPatientRow[];
  missedExpansion: MissedExpansionRow[];
  institutionalTiming: InstitutionalTimingInsight[];
  playbookEntryZones: PlaybookEntryZone[];
  synthesis: { id: string; headline: string; detail: string }[];
  advisoryOnly: true;
}
