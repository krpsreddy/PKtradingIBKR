import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { LiveExecutionDecision } from '../live-decision/live-decision.models';
import {
  ConfidenceTier,
  ContinuationClassification,
  ContinuationEntryType,
  ContinuationPromotionInput
} from './continuation-promotion.models';
import { TradingSignal } from '../../../models/signal.model';

export const MIN_AUTHORITATIVE = 10;
export const MIN_LOW_CONFIDENCE = 25;
export const MIN_PROMOTION_SAMPLE = 50;

export const PROMOTION_THRESHOLDS = {
  winRate: 70,
  avgR: 1.5,
  continuationPct: 60,
  fakeoutPct: 20
};

export function confidenceTier(n: number): ConfidenceTier {
  if (n < MIN_AUTHORITATIVE) return 'INSUFFICIENT';
  if (n < MIN_LOW_CONFIDENCE) return 'LOW';
  if (n < MIN_PROMOTION_SAMPLE) return 'MODERATE';
  return 'HIGH';
}

export function isPromotableStats(stats: {
  count: number;
  winRate: number;
  avgR: number;
  continuationPct: number;
  fakeoutPct: number;
}): boolean {
  return stats.count >= MIN_PROMOTION_SAMPLE
    && stats.winRate > PROMOTION_THRESHOLDS.winRate
    && stats.avgR > PROMOTION_THRESHOLDS.avgR
    && stats.continuationPct > PROMOTION_THRESHOLDS.continuationPct
    && stats.fakeoutPct < PROMOTION_THRESHOLDS.fakeoutPct;
}

export function mfeR(s: SignalSnapshot): number {
  return s.evaluation?.mfeR ?? 0;
}

export function sessionDateFromTs(ts: number): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function isWaitOrAvoid(d: LiveExecutionDecision): boolean {
  return d.includes('WAIT') || d.includes('AVOID') || d === 'REDUCE_SIZE';
}

export function isSecondLegSignal(input: ContinuationPromotionInput | TradingSignal): boolean {
  const t = ('signalType' in input ? input.signalType : '') ?? '';
  const seq = 'sequencingState' in input ? input.sequencingState : '';
  return t.includes('CONT') || seq === 'SECOND_LEG_CONFIRMED' || seq === 'CONTINUATION_ACCEPTED';
}

export function isReclaimSignal(input: ContinuationPromotionInput | TradingSignal): boolean {
  const t = ('signalType' in input ? input.signalType : '') ?? '';
  const seq = 'sequencingState' in input ? input.sequencingState : '';
  return t.includes('PULL') || seq === 'RECLAIM_CONFIRMED' || seq === 'RECLAIM_IN_PROGRESS';
}

export function isContinuationPrecursor(signalType: string): boolean {
  return signalType === 'MOM_READY' || signalType === 'CONT_READY' || signalType === 'PULL_READY'
    || signalType === 'MOM_BUY' || signalType === 'CONT_BUY' || signalType === 'PULL_BUY';
}

export function entryTypeLabel(t: ContinuationEntryType): string {
  switch (t) {
    case 'CONTINUATION_BUY': return 'CONT BUY';
    case 'VWAP_RECLAIM_BUY': return 'VWAP RECLAIM';
    case 'SECOND_LEG_BUY': return '2ND LEG';
    case 'DIGESTION_BREAKOUT': return 'DIGESTION';
    case 'TREND_ACCEPTANCE_BUY': return 'TREND ACC';
    case 'PULLBACK_HOLD_ENTRY': return 'PULLBACK HOLD';
    case 'ADD_ON_RECLAIM': return 'ADD RECLAIM';
  }
}

export function entryTypeMarker(t: ContinuationEntryType): string {
  switch (t) {
    case 'CONTINUATION_BUY': return '▲ CONT BUY';
    case 'VWAP_RECLAIM_BUY': return '▲ VWAP RECLAIM';
    case 'SECOND_LEG_BUY': return '▲ 2ND LEG';
    case 'DIGESTION_BREAKOUT': return '▲ DIGESTION';
    case 'TREND_ACCEPTANCE_BUY': return '▲ TREND ACC';
    case 'PULLBACK_HOLD_ENTRY': return '▲ PULLBACK HOLD';
    case 'ADD_ON_RECLAIM': return '▲ ADD RECLAIM';
  }
}

export function promotionMarkerColor(promoted: boolean): string {
  return promoted ? '#10b981' : '#94a3b8';
}

export function inputFromSignal(signal: TradingSignal, sampleCount: number): ContinuationPromotionInput {
  return {
    symbol: signal.symbol ?? 'UNK',
    signalType: signal.signalType,
    rvol: signal.relativeVolume ?? undefined,
    vwapDistance: signal.vwap != null && signal.price
      ? (signal.price - signal.vwap) / signal.price
      : undefined,
    extended: signal.extended,
    sampleCount
  };
}

export function mapClassificationToEntryType(c: ContinuationClassification): ContinuationEntryType {
  switch (c) {
    case 'INSTITUTIONAL_RECLAIM': return 'VWAP_RECLAIM_BUY';
    case 'SECOND_LEG_ACCEPTANCE': return 'SECOND_LEG_BUY';
    case 'TREND_DIGESTION': return 'DIGESTION_BREAKOUT';
    case 'CONTROLLED_PULLBACK': return 'PULLBACK_HOLD_ENTRY';
    case 'HEALTHY_CONTINUATION': return 'CONTINUATION_BUY';
    default: return 'TREND_ACCEPTANCE_BUY';
  }
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
