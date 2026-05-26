import { EmergingSetup } from '../models/refinement.model';
import { SetupCandidate } from '../models/execution.model';
import { TradingSymbol } from '../models/trading-symbol.model';
import { sortByAttention } from './attention-score.util';
import { toCandidateFromWatchlist } from './watchlist-candidate.util';

export interface WatchCandidate {
  symbol: string;
  label: string;
  signalType: string;
  score: number;
}

export function buildWatchCandidates(
  emerging: EmergingSetup[],
  watchlist: TradingSymbol[],
  bestSetup: SetupCandidate
): WatchCandidate[] {
  const out: WatchCandidate[] = [];

  for (const e of emerging.slice(0, 4)) {
    const label = e.state === 'NEAR_TRIGGER' ? 'NEAR TRIGGER'
      : e.state === 'READYING' ? 'BUILDING'
      : e.state === 'BUILDING' ? 'EARLY MOMENTUM' : 'WATCHING';
    out.push({ symbol: e.symbol, label, signalType: e.setupType, score: e.rankScore ?? 40 });
  }

  const sorted = sortByAttention(
    watchlist.filter(w => w.enabled).map(toCandidateFromWatchlist)
  ).slice(0, 3);

  for (const c of sorted) {
    if (out.some(o => o.symbol === c.symbol)) continue;
    const label = c.freshness === 'FRESH' ? 'NEAR TRIGGER' : 'WATCHING';
    out.push({ symbol: c.symbol, label, signalType: c.signalType, score: c.rankScore ?? 30 });
  }

  if (!out.length && bestSetup.symbol !== '—') {
    out.push({ symbol: bestSetup.symbol, label: 'WATCHING', signalType: bestSetup.signalType, score: 25 });
  }

  return out.slice(0, 5);
}
