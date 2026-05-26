import { MarketTrend } from '../models/workspace.model';
import { ActiveSignal, HotMomentumItem } from '../models/workspace.model';
import { EmergingSetup } from '../models/refinement.model';
import { TradingSymbol } from '../models/trading-symbol.model';

export type EmptyContext = 'signals' | 'journal' | 'timeline' | 'emerging' | 'opportunities';

export function smartEmptyMessage(
  context: EmptyContext,
  marketTrend: MarketTrend | null,
  activeCount = 0
): { title: string; detail: string } {
  const regime = marketTrend?.regime ?? '';
  if (context === 'signals' || context === 'opportunities') {
    if (regime === 'CHOPPY') {
      return { title: 'CHOPPY regime suppressing expansion', detail: 'Wait for participation expansion or regime shift.' };
    }
    if (regime === 'LOW_MOMENTUM') {
      return { title: 'Low participation session', detail: 'No high-RVOL expansion detected yet.' };
    }
    if (activeCount === 0) {
      return { title: 'Market currently lacks edge', detail: 'No confirmed autonomous opportunities detected.' };
    }
  }
  if (context === 'journal') {
    return { title: 'No journal entries', detail: 'Log trades to build adaptive ranking & execution edge analytics.' };
  }
  if (context === 'timeline') {
    return { title: 'No lifecycle events yet', detail: 'Timeline fills as execution regimes evolve for this symbol.' };
  }
  if (context === 'emerging') {
    return { title: 'No compression watch', detail: 'Watching for compression ready · persistence building · early expansion forming.' };
  }
  return { title: 'Nothing here yet', detail: '—' };
}

export interface SymbolSwitcherSection {
  label: string;
  symbols: string[];
}

export function buildSwitcherSections(
  watchlist: TradingSymbol[],
  recent: string[],
  hot: HotMomentumItem[],
  emerging: EmergingSetup[],
  active: ActiveSignal[],
  selected: string
): SymbolSwitcherSection[] {
  const sections: SymbolSwitcherSection[] = [];
  const enabled = [...watchlist.filter(w => w.enabled)].sort(
    (a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.symbol.localeCompare(b.symbol)
  );

  const pinned = enabled.filter(w => w.pinned).map(w => w.symbol);
  if (pinned.length) sections.push({ label: 'Pinned', symbols: pinned });

  const rec = recent.filter(s => s !== selected && enabled.some(w => w.symbol === s)).slice(0, 6);
  if (rec.length) sections.push({ label: 'Recent', symbols: rec });

  const hotSyms = hot.map(h => h.symbol).filter(s => enabled.some(w => w.symbol === s)).slice(0, 6);
  if (hotSyms.length) sections.push({ label: 'High Conviction', symbols: hotSyms });

  if (enabled.length) {
    sections.push({
      label: `All Symbols (${enabled.length})`,
      symbols: enabled.map(w => w.symbol)
    });
  }
  return sections;
}
