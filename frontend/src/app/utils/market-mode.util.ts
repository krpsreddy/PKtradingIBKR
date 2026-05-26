import { TradingSymbol } from '../models/trading-symbol.model';
import { HotMomentumItem } from '../models/workspace.model';
import { EmergingSetup } from '../models/refinement.model';
import { ScannerOpportunityCard } from '../services/autonomous-regime-scanner/autonomous-regime-scanner.models';

export interface MarketModeRow {
  symbol: string;
  label: string;
  detail: string;
  score: number;
  priority: 'high' | 'low';
}

export function buildMarketModeRows(
  watchlist: TradingSymbol[],
  hotMomentum: HotMomentumItem[],
  emerging: EmergingSetup[],
  autonomousTop: ScannerOpportunityCard[] = []
): MarketModeRow[] {
  const out: MarketModeRow[] = [];
  const seen = new Set<string>();

  for (const c of autonomousTop.slice(0, 4)) {
    seen.add(c.symbol);
    out.push({
      symbol: c.symbol,
      label: c.action,
      detail: `${c.convictionScore} conviction · ${c.badge.replace(/^[^\s]+\s/, '')}`,
      score: c.convictionScore,
      priority: c.convictionScore >= 70 ? 'high' : 'low'
    });
  }

  const byRvol = [...watchlist]
    .filter(w => w.enabled && (w.relativeVolume ?? 0) >= 1.5 && !seen.has(w.symbol))
    .sort((a, b) => (b.relativeVolume ?? 0) - (a.relativeVolume ?? 0))
    .slice(0, 4);

  for (const w of byRvol) {
    seen.add(w.symbol);
    out.push({
      symbol: w.symbol,
      label: 'HIGH PARTICIPATION',
      detail: `${(w.relativeVolume ?? 0).toFixed(1)}x · ${w.trend ?? '—'}`,
      score: w.rankScore ?? 40,
      priority: (w.relativeVolume ?? 0) >= 3 ? 'high' : 'low'
    });
  }

  for (const m of hotMomentum.slice(0, 2)) {
    if (seen.has(m.symbol)) continue;
    seen.add(m.symbol);
    out.push({
      symbol: m.symbol,
      label: 'CONTINUATION',
      detail: m.signalType,
      score: 50 + (m.rank === 1 ? 15 : 0),
      priority: m.rank === 1 ? 'high' : 'low'
    });
  }

  for (const e of emerging.slice(0, 3)) {
    if (seen.has(e.symbol)) continue;
    out.push({
      symbol: e.symbol,
      label: e.state === 'NEAR_TRIGGER' ? 'NEAR TRIGGER' : 'BUILDING',
      detail: e.setupType,
      score: e.rankScore ?? 35,
      priority: e.state === 'NEAR_TRIGGER' ? 'high' : 'low'
    });
  }

  const trendLeaders = watchlist
    .filter(w => w.enabled && w.trend === 'bullish' && !seen.has(w.symbol))
    .sort((a, b) => (b.rankScore ?? 0) - (a.rankScore ?? 0))
    .slice(0, 2);

  for (const w of trendLeaders) {
    out.push({
      symbol: w.symbol,
      label: 'TREND LEADER',
      detail: w.mtfSummary ?? 'Aligned',
      score: w.rankScore ?? 30,
      priority: 'low'
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
