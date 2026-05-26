import { SymbolCapitalRank } from '../edge-discovery/edge-discovery.models';
import { EdgeTodaySnapshot, LiveCapitalAllocationRow, CapitalFocusStatus } from './live-execution.models';
import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals } from '../signal-intelligence.math';

/** Determines which symbols deserve focus TODAY — advisory capital allocation. */
export class LiveCapitalAllocationEngine {

  rankSymbol(
    symbol: string,
    historical: SymbolCapitalRank | null,
    todaySignals: SignalSnapshot[]
  ): LiveCapitalAllocationRow {
    const sym = symbol.toUpperCase();
    const today = todaySignals.filter(s => s.symbol === sym);
    const evaluated = evaluatedSignals(today);
    const todayExp = computeExpectancyR(today);
    const histScore = historical?.edgeScore ?? 50;

    let todayEdge = histScore;
    if (evaluated.length >= 2) {
      todayEdge = Math.round(histScore * 0.4 + clampScore(todayExp) * 0.6);
    } else if (evaluated.length === 1) {
      todayEdge = Math.round(histScore * 0.7 + clampScore(todayExp) * 0.3);
    }

    const status = focusStatus(todayEdge, historical?.capitalRank);

    return {
      symbol: sym,
      todayEdge,
      status,
      historicalEdge: histScore
    };
  }

  rankWatchlist(
    symbols: string[],
    rankings: SymbolCapitalRank[],
    todayBySymbol: Map<string, SignalSnapshot[]>
  ): LiveCapitalAllocationRow[] {
    return symbols.map(sym => {
      const rank = rankings.find(r => r.symbol === sym.toUpperCase()) ?? null;
      return this.rankSymbol(sym, rank, todayBySymbol.get(sym.toUpperCase()) ?? []);
    }).sort((a, b) => b.todayEdge - a.todayEdge);
  }
}

function clampScore(exp: number): number {
  return Math.round(Math.min(100, Math.max(0, 50 + exp * 80)));
}

function focusStatus(todayEdge: number, capitalRank?: string): CapitalFocusStatus {
  if (todayEdge >= 75) return 'FOCUS';
  if (todayEdge >= 58) return 'ACTIVE';
  if (todayEdge >= 40) return 'REDUCE';
  if (capitalRank === 'AVOID') return 'AVOID';
  return todayEdge < 35 ? 'AVOID' : 'REDUCE';
}

export function capitalStatusFromEdgeToday(edgeToday: EdgeTodaySnapshot, todayEdge: number): CapitalFocusStatus {
  if (edgeToday.openingFakeoutsElevated && todayEdge < 60) return 'REDUCE';
  if (edgeToday.reclaimsWorking && todayEdge >= 65) return 'FOCUS';
  return focusStatus(todayEdge);
}
