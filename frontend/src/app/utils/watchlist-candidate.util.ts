import { SetupCandidate } from '../models/execution.model';
import { TradingSymbol } from '../models/trading-symbol.model';

export function toCandidateFromWatchlist(w: TradingSymbol): SetupCandidate {
  const signalType = w.signalState && w.signalState !== 'NONE' ? w.signalState : (w.momentumState ?? 'WATCH');
  return {
    symbol: w.symbol,
    signalType,
    price: w.price,
    relativeVolume: w.relativeVolume,
    lifecycleState: w.lifecycleState,
    confidenceScore: w.confidenceScore,
    confidenceLabel: w.confidenceLabel,
    rankScore: w.rankScore,
    mtfSummary: w.mtfSummary,
    freshness: w.freshness,
    freshnessLabel: w.freshnessLabel,
    extended: w.extended,
    extendedState: w.extendedState,
    optionsWarnings: w.optionsWarnings,
    regimeAligned: w.regimeAligned
  };
}
