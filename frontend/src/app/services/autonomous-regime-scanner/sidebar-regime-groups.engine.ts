import { ScannerOpportunityCard, ScannerSnapshot } from './autonomous-regime-scanner.models';
import { compareScannerCards } from './scanner-prioritization.engine';
import { resolveScannerLiveState } from './scanner-state.engine';

export type SidebarRegimeGroupId =
  | 'HIGH_CONVICTION_CONTINUATIONS'
  | 'EARLY_EXPANSION'
  | 'INSTITUTIONAL_PERSISTENCE'
  | 'HEALTHY_SHALLOW_PULLBACKS'
  | 'VWAP_ACCEPTANCE'
  | 'COMPRESSION_BREAKOUTS'
  | 'TREND_RESUMPTION'
  | 'EXHAUSTION_AVOID'
  | 'REGIME_TRANSITIONS'
  | 'WATCHLIST_PRIORITIES';

export interface SidebarRegimeGroup {
  id: SidebarRegimeGroupId;
  title: string;
  cards: ScannerOpportunityCard[];
  defaultOpen: boolean;
  fadeExhaustion?: boolean;
}

const GROUP_META: Record<SidebarRegimeGroupId, { title: string; defaultOpen: boolean; fadeExhaustion?: boolean }> = {
  HIGH_CONVICTION_CONTINUATIONS: { title: 'High Conviction Continuations', defaultOpen: true },
  EARLY_EXPANSION: { title: 'Early Expansion', defaultOpen: true },
  INSTITUTIONAL_PERSISTENCE: { title: 'Institutional Persistence', defaultOpen: false },
  HEALTHY_SHALLOW_PULLBACKS: { title: 'Healthy Shallow Pullbacks', defaultOpen: false },
  VWAP_ACCEPTANCE: { title: 'VWAP Acceptance', defaultOpen: false },
  COMPRESSION_BREAKOUTS: { title: 'Compression Breakouts', defaultOpen: false },
  TREND_RESUMPTION: { title: 'Trend Resumption', defaultOpen: false },
  EXHAUSTION_AVOID: { title: 'Exhaustion / Do Not Chase', defaultOpen: false, fadeExhaustion: true },
  REGIME_TRANSITIONS: { title: 'Regime Transitions', defaultOpen: true },
  WATCHLIST_PRIORITIES: { title: 'Watchlist Priorities', defaultOpen: true }
};

function dedupeCards(cards: ScannerOpportunityCard[]): ScannerOpportunityCard[] {
  const bySym = new Map<string, ScannerOpportunityCard>();
  for (const c of cards) {
    const prev = bySym.get(c.symbol);
    if (!prev || compareScannerCards(c, prev) < 0) {
      bySym.set(c.symbol, c);
    }
  }
  return [...bySym.values()].sort(compareScannerCards);
}

function allSnapshotCards(snapshot: ScannerSnapshot): ScannerOpportunityCard[] {
  return dedupeCards([
    ...snapshot.topOpportunities,
    ...snapshot.highContinuation,
    ...snapshot.earlyExpansion,
    ...snapshot.institutionalPersistence,
    ...snapshot.healthyPullback,
    ...snapshot.compressionBreakout,
    ...snapshot.exhaustionAvoid
  ]);
}

function sortCards(cards: ScannerOpportunityCard[]): ScannerOpportunityCard[] {
  return [...cards].sort(compareScannerCards);
}

function filterType(cards: ScannerOpportunityCard[], ...types: ScannerOpportunityCard['opportunityType'][]): ScannerOpportunityCard[] {
  return sortCards(cards.filter(c => types.includes(c.opportunityType)));
}

function risingOrTransition(c: ScannerOpportunityCard): boolean {
  if (c.isRising || c.popVelocity >= 4) return true;
  const state = resolveScannerLiveState(c);
  return state === 'EARLY_EXPANSION' || state === 'REGIME_BREAKDOWN';
}

export function buildSidebarRegimeGroups(
  snapshot: ScannerSnapshot | null,
  watchlistSymbols: string[]
): SidebarRegimeGroup[] {
  if (!snapshot) {
    return Object.entries(GROUP_META).map(([id, meta]) => ({
      id: id as SidebarRegimeGroupId,
      title: meta.title,
      cards: [],
      defaultOpen: meta.defaultOpen,
      fadeExhaustion: meta.fadeExhaustion
    }));
  }

  const all = allSnapshotCards(snapshot);
  const wl = new Set(watchlistSymbols.map(s => s.toUpperCase()));

  const groups: SidebarRegimeGroup[] = [
    {
      ...GROUP_META.HIGH_CONVICTION_CONTINUATIONS,
      id: 'HIGH_CONVICTION_CONTINUATIONS',
      cards: sortCards(snapshot.highContinuation.length ? snapshot.highContinuation : filterType(all, 'EARLY_CONTINUATION'))
    },
    {
      ...GROUP_META.EARLY_EXPANSION,
      id: 'EARLY_EXPANSION',
      cards: sortCards(snapshot.earlyExpansion.length ? snapshot.earlyExpansion : all.filter(c => c.isRising || c.expansionProbability >= 65))
    },
    {
      ...GROUP_META.INSTITUTIONAL_PERSISTENCE,
      id: 'INSTITUTIONAL_PERSISTENCE',
      cards: sortCards(snapshot.institutionalPersistence.length
        ? snapshot.institutionalPersistence
        : filterType(all, 'INSTITUTIONAL_ACCELERATION'))
    },
    {
      ...GROUP_META.HEALTHY_SHALLOW_PULLBACKS,
      id: 'HEALTHY_SHALLOW_PULLBACKS',
      cards: sortCards(snapshot.healthyPullback.length
        ? snapshot.healthyPullback
        : filterType(all, 'SHALLOW_PULLBACK_CONTINUATION'))
    },
    {
      ...GROUP_META.VWAP_ACCEPTANCE,
      id: 'VWAP_ACCEPTANCE',
      cards: filterType(all, 'VWAP_PERSISTENCE')
    },
    {
      ...GROUP_META.COMPRESSION_BREAKOUTS,
      id: 'COMPRESSION_BREAKOUTS',
      cards: sortCards(snapshot.compressionBreakout.length
        ? snapshot.compressionBreakout
        : filterType(all, 'COMPRESSION_RELEASE'))
    },
    {
      ...GROUP_META.TREND_RESUMPTION,
      id: 'TREND_RESUMPTION',
      cards: filterType(all, 'TREND_RESUMPTION')
    },
    {
      ...GROUP_META.EXHAUSTION_AVOID,
      id: 'EXHAUSTION_AVOID',
      cards: sortCards(snapshot.exhaustionAvoid.length
        ? snapshot.exhaustionAvoid
        : all.filter(c => c.action === 'AVOID' || c.exhaustionProbability >= 55))
        .sort((a, b) => b.exhaustionProbability - a.exhaustionProbability)
    },
    {
      ...GROUP_META.REGIME_TRANSITIONS,
      id: 'REGIME_TRANSITIONS',
      cards: sortCards(all.filter(risingOrTransition))
    },
    {
      ...GROUP_META.WATCHLIST_PRIORITIES,
      id: 'WATCHLIST_PRIORITIES',
      cards: sortCards(all.filter(c => wl.has(c.symbol)))
    }
  ];

  return groups;
}

export function topAutonomousOpportunity(snapshot: ScannerSnapshot | null): ScannerOpportunityCard | null {
  if (!snapshot?.topOpportunities.length) return null;
  const actionable = snapshot.topOpportunities.filter(c => c.action !== 'AVOID');
  const pool = actionable.length ? actionable : snapshot.topOpportunities;
  return [...pool].sort(compareScannerCards)[0] ?? null;
}

export function watchlistRegimeGroups(
  snapshot: ScannerSnapshot | null,
  watchlistSymbols: string[]
): { label: string; symbols: string[] }[] {
  const groups = buildSidebarRegimeGroups(snapshot, watchlistSymbols);
  const out: { label: string; symbols: string[] }[] = [];
  const seen = new Set<string>();

  for (const g of groups) {
    if (g.id === 'WATCHLIST_PRIORITIES' || g.id === 'EXHAUSTION_AVOID') continue;
    const symbols = g.cards.map(c => c.symbol).filter(s => {
      if (seen.has(s)) return false;
      seen.add(s);
      return watchlistSymbols.map(x => x.toUpperCase()).includes(s);
    });
    if (symbols.length) {
      out.push({ label: g.title.replace(/ \/ Do Not Chase$/, '').replace(/^High Conviction /, ''), symbols: symbols.slice(0, 6) });
    }
  }

  const exhaustion = groups.find(g => g.id === 'EXHAUSTION_AVOID')?.cards
    .map(c => c.symbol)
    .filter(s => watchlistSymbols.map(x => x.toUpperCase()).includes(s)) ?? [];
  if (exhaustion.length) {
    out.push({ label: 'Exhaustion', symbols: exhaustion.slice(0, 6) });
  }

  return out.slice(0, 5);
}
