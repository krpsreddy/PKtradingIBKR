import { SetupCandidate } from '../models/execution.model';
import {
  ActiveSignal,
  HotMomentumItem,
  OpeningMomentumItem
} from '../models/workspace.model';
import { TradingSymbol } from '../models/trading-symbol.model';
import { toCandidateFromWatchlist } from './watchlist-candidate.util';

type AttentionSource = SetupCandidate;

const BULLISH_BUY = new Set(['MOM_BUY', 'PULL_BUY', 'CONT_BUY', 'OPEN_MOM_BUY', 'OPEN_SCOUT', 'IMBALANCE_UP', 'CONT_READY', 'OPEN_READY']);
const TYPE_PRIORITY: Record<string, number> = {
  OPEN_MOM_BUY: 18,
  OPEN_SCOUT: 14,
  MOM_BUY: 12,
  CONT_BUY: 10,
  CONT_READY: 9,
  OPEN_READY: 8,
  PULL_BUY: 8,
  OPEN_FAIL: 6,
  RECOVERY_FAIL: 6,
  IMBALANCE_DOWN: 5
};

export function computeAttentionScore(source: AttentionSource): number {
  let score = 0;

  const freshness = source.freshness?.toUpperCase();
  if (freshness === 'FRESH') score += 30;
  else if (freshness === 'ACTIVE') score += 22;
  else if (freshness === 'AGING') score += 10;
  else if (freshness === 'STALE') score += 2;

  score += Math.min(25, (source.rankScore ?? 0) * 0.25);

  const rvol = source.relativeVolume ?? 0;
  if (rvol >= 4) score += 15;
  else if (rvol >= 2) score += 10;
  else if (rvol >= 1.5) score += 5;

  if (source.mtfSummary?.toLowerCase().includes('bullish')) score += 8;
  if (source.extended) score -= 12;
  if (source.optionsWarnings?.length) score -= source.optionsWarnings.length * 4;

  score += TYPE_PRIORITY[source.signalType] ?? 4;

  const lifecycle = source.lifecycleState?.toUpperCase();
  if (lifecycle === 'WEAKENING') score -= 10;
  if (lifecycle === 'INVALIDATED' || lifecycle === 'EXITED') score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function sortByAttention<T extends AttentionSource>(items: T[]): T[] {
  return [...items].sort((a, b) => computeAttentionScore(b) - computeAttentionScore(a));
}

export function pickBestSetup(
  active: ActiveSignal[],
  hot: HotMomentumItem[],
  opening: OpeningMomentumItem[] = [],
  continuation: HotMomentumItem[] = [],
  watchlist: TradingSymbol[] = []
): SetupCandidate {
  const merged: SetupCandidate[] = [
    ...active,
    ...hot.filter(h => BULLISH_BUY.has(h.signalType) || h.signalType.includes('FAIL')),
    ...opening,
    ...continuation.filter(c => BULLISH_BUY.has(c.signalType))
  ];

  if (merged.length) {
    const sorted = sortByAttention(merged);
    const top = sorted[0];
    const found = active.find(a => a.symbol === top.symbol && a.signalType === top.signalType)
      ?? hot.find(h => h.symbol === top.symbol && h.signalType === top.signalType)
      ?? opening.find(o => o.symbol === top.symbol && o.signalType === top.signalType)
      ?? continuation.find(c => c.symbol === top.symbol && c.signalType === top.signalType);
    return found ?? top;
  }

  const watchCandidates = watchlist
    .filter(w => w.enabled && (w.rankScore != null || w.momentumState || w.relativeVolume))
    .map(toCandidateFromWatchlist);

  if (watchCandidates.length) {
    return sortByAttention(watchCandidates)[0];
  }

  if (watchlist.length) {
    return toCandidateFromWatchlist(watchlist.find(w => w.enabled) ?? watchlist[0]);
  }

  return { symbol: '—', signalType: 'WATCH', rankScore: 0, freshness: 'STALE' };
}
