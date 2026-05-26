import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { TradingSignal } from '../../../models/signal.model';
import {
  ConfidenceTier,
  OpeningExpansionCaseStudy,
  OpeningExpansionEntryType,
  OpeningExpansionInput,
  OpeningParticipationMode
} from './opening-expansion.models';

export const OPENING_WINDOW_MIN = 30;
export const FIRST_FIVE_MIN = 5;

export const EXPANSION_PROMOTION_THRESHOLDS = {
  winRate: 70,
  avgR: 2,
  continuationPct: 70,
  fakeoutPct: 20,
  minSample: 50
};

export const QCOM_CASE_STUDIES: OpeningExpansionCaseStudy[] = [
  {
    id: 'qcom-212-240',
    label: 'QCOM 212→240',
    symbol: 'QCOM',
    entryZone: [210, 216],
    targetZone: [235, 242],
    earliestParticipation: '9:35 OPEN_MOM_BUY · institutional imbalance · RVOL stack',
    firstFiveMinQualification: 'Gap continuation + ORB acceptance + sustained RVOL > 2.5x',
    firstPullbackAddZone: '10:05–10:15 shallow digestion above opening range',
    trendPersistenceSignals: [
      'No VWAP revisit after 9:45',
      'Stacked continuation candles 9:35–10:00',
      'Breadth aligned · sector RS strong'
    ],
    governanceSuppressionCause: 'WAIT_FOR_PULLBACK bias · extended flag before +3R proved',
    idealEntryType: 'OPENING_DRIVE_BUY'
  }
];

export function confidenceTier(n: number): ConfidenceTier {
  if (n < 10) return 'INSUFFICIENT';
  if (n < 25) return 'LOW';
  if (n < 50) return 'MODERATE';
  return 'HIGH';
}

export function isPromotableExpansion(stats: {
  count: number;
  winRate: number;
  avgR: number;
  continuationPct: number;
  fakeoutPct: number;
}): boolean {
  return stats.count >= EXPANSION_PROMOTION_THRESHOLDS.minSample
    && stats.winRate > EXPANSION_PROMOTION_THRESHOLDS.winRate
    && stats.avgR > EXPANSION_PROMOTION_THRESHOLDS.avgR
    && stats.continuationPct > EXPANSION_PROMOTION_THRESHOLDS.continuationPct
    && stats.fakeoutPct < EXPANSION_PROMOTION_THRESHOLDS.fakeoutPct;
}

export function mfeR(s: SignalSnapshot): number {
  return s.evaluation?.mfeR ?? 0;
}

export function sessionDateFromTs(ts: number): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function sessionMinutesFromTs(ts: string): number | undefined {
  const parsed = Date.parse(ts);
  if (!Number.isFinite(parsed)) return undefined;
  const d = new Date(parsed);
  const et = new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return et.getHours() * 60 + et.getMinutes() - 9 * 60 - 30;
}

export function inputFromSignal(signal: TradingSignal, sampleCount = 0): OpeningExpansionInput {
  return {
    symbol: (signal.symbol ?? 'UNK').toUpperCase(),
    signalType: signal.signalType,
    sessionTimeMinutes: sessionMinutesFromTs(signal.timestamp),
    rvol: signal.relativeVolume ?? undefined,
    vwapDistance: signal.vwap != null && signal.price
      ? (signal.price - signal.vwap) / signal.price
      : undefined,
    trendAlignment: signal.confidenceScore ?? undefined,
    extended: signal.extended,
    score: signal.confidenceScore ?? undefined,
    sampleCount
  };
}

export function isOpeningSignal(signalType: string): boolean {
  const t = signalType.toUpperCase();
  return t.includes('OPEN') || t === 'IMBALANCE_UP' || t === 'OPEN_MOM_BUY' || t === 'OPEN_SCOUT';
}

export function isOpeningTrap(signalType: string): boolean {
  const t = signalType.toUpperCase();
  return t.includes('FAIL') || t === 'IMBALANCE_DOWN' || t.includes('TRAP');
}

export function mapModeToEntryType(
  mode: OpeningParticipationMode,
  input: OpeningExpansionInput
): OpeningExpansionEntryType {
  const t = input.signalType.toUpperCase();
  if (mode === 'FIRST_PULLBACK_ADD') return 'FIRST_PULLBACK_BUY';
  if (t === 'IMBALANCE_UP') return 'INSTITUTIONAL_IMBALANCE_BUY';
  if ((input.sessionTimeMinutes ?? 999) <= FIRST_FIVE_MIN) return 'EARLY_EXPANSION_BUY';
  if (mode === 'OPENING_DRIVE_FULL') return 'OPENING_DRIVE_BUY';
  if (t.includes('READY') || t.includes('SCOUT')) return 'OPENING_ACCEPTANCE_BUY';
  return 'TREND_DAY_INITIATION';
}

export function entryTypeMarker(t: OpeningExpansionEntryType): string {
  switch (t) {
    case 'OPENING_DRIVE_BUY': return 'OPEN DRIVE';
    case 'EARLY_EXPANSION_BUY': return 'EARLY EXP';
    case 'INSTITUTIONAL_IMBALANCE_BUY': return 'IMBALANCE BUY';
    case 'TREND_DAY_INITIATION': return 'TREND DAY';
    case 'FIRST_PULLBACK_BUY': return 'FIRST PB ADD';
    case 'OPENING_ACCEPTANCE_BUY': return 'OPEN ACC';
  }
}

export function entryTypeLabel(t: OpeningExpansionEntryType): string {
  return entryTypeMarker(t).replace(/_/g, ' ');
}

export function expansionMarkerColor(): string {
  return '#f59e0b';
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
