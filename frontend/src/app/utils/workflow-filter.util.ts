import { WorkflowFilters } from '../models/workflow-filters.model';
import { ActiveSignal } from '../models/workspace.model';
import { TradingSymbol } from '../models/trading-symbol.model';
import { ScannerOpportunityCard } from '../services/autonomous-regime-scanner/autonomous-regime-scanner.models';
import {
  AutonomousRegimeType,
  resolveAutonomousRegime
} from './autonomous-terminology.util';

const BEARISH_REGIMES = new Set<AutonomousRegimeType>([
  'FAILED_EXPANSION',
  'EXHAUSTION_DRIFT'
]);

function regimeOfItem(
  item: { signalType: string; narrative?: string | null },
  cards?: Record<string, ScannerOpportunityCard>,
  symbol?: string
): AutonomousRegimeType {
  const sym = symbol ?? ('symbol' in item ? (item as { symbol?: string }).symbol : undefined);
  const card = sym ? cards?.[sym.toUpperCase()] : undefined;
  if (card) {
    return resolveAutonomousRegime(card.opportunityType, card.badge);
  }
  return resolveAutonomousRegime(item.signalType, item.narrative ?? null);
}

function matchesAutonomousFilter(
  regime: AutonomousRegimeType,
  filters: WorkflowFilters,
  item: { relativeVolume?: number | null; rankScore?: number | null; convictionScore?: number },
  card?: ScannerOpportunityCard | null
): boolean {
  if (filters.earlyExpansionOnly && regime !== 'EARLY_EXPANSION') return false;
  if (filters.persistenceOnly && regime !== 'PERSISTENT_CONTINUATION' && regime !== 'ACCELERATION_INTEGRITY') return false;
  if (filters.healthyPullbackOnly && regime !== 'SHALLOW_PULLBACK_CONTINUATION') return false;
  if (filters.vwapAcceptanceOnly && regime !== 'VWAP_ACCEPTANCE') return false;
  if (filters.compressionReadyOnly && regime !== 'COMPRESSION_BREAKOUT') return false;
  if (filters.failedExpansionOnly && regime !== 'FAILED_EXPANSION') return false;
  if (filters.exhaustionRiskOnly && regime !== 'EXHAUSTION_DRIFT' && regime !== 'LATE_EXTENSION') return false;
  if (filters.regimeTransitionOnly && regime !== 'REGIME_TRANSITION') return false;
  if (filters.highVelocityOnly) {
    const vel = card?.popVelocity ?? 0;
    if (vel < 8) return false;
  }
  if (filters.confirmedOnly) {
    const conv = card?.convictionScore ?? item.rankScore ?? item.convictionScore ?? 0;
    if (conv < 70) return false;
  }
  if (filters.developingOnly) {
    const conv = card?.convictionScore ?? item.rankScore ?? 0;
    if (conv >= 70) return false;
  }
  return true;
}

export function applyWorkflowFilters<
  T extends {
    signalType: string;
    symbol?: string;
    narrative?: string | null;
    extended?: boolean;
    freshness?: string | null;
    rankScore?: number | null;
    relativeVolume?: number | null;
    mtfSummary?: string | null;
  }
>(items: T[], filters: WorkflowFilters, autonomousCards: Record<string, ScannerOpportunityCard> = {}): T[] {
  return items.filter(item => {
    const regime = regimeOfItem(item, autonomousCards, item.symbol);
    const card = item.symbol ? autonomousCards[item.symbol.toUpperCase()] : undefined;

    if (filters.bullishOnly && BEARISH_REGIMES.has(regime)) return false;
    if (filters.bearishOnly && !BEARISH_REGIMES.has(regime)) return false;
    if (filters.freshOnly && item.freshness !== 'FRESH' && item.freshness !== 'ACTIVE') return false;
    if (filters.highRvolOnly && (item.relativeVolume ?? 0) < 2) return false;
    if (filters.mtfAlignedOnly && !item.mtfSummary?.toLowerCase().includes('bullish')) return false;

    return matchesAutonomousFilter(regime, filters, item, card);
  });
}

export function filterWatchlist(
  symbols: TradingSymbol[],
  filters: WorkflowFilters,
  autonomousCards: Record<string, ScannerOpportunityCard> = {}
): TradingSymbol[] {
  return symbols.filter(s => {
    const pseudo = {
      signalType: s.signalState ?? 'WATCH',
      symbol: s.symbol,
      relativeVolume: s.relativeVolume,
      rankScore: s.rankScore,
      freshness: s.freshness,
      mtfSummary: s.mtfSummary
    };
    return applyWorkflowFilters([pseudo], filters, autonomousCards).length > 0;
  });
}

export function sortActiveSignals(signals: ActiveSignal[]): ActiveSignal[] {
  const freshnessOrder: Record<string, number> = { FRESH: 4, ACTIVE: 3, AGING: 2, STALE: 1 };
  return [...signals].sort((a, b) => {
    const fa = freshnessOrder[a.freshness ?? ''] ?? 0;
    const fb = freshnessOrder[b.freshness ?? ''] ?? 0;
    if (fa !== fb) return fb - fa;
    const ra = a.rankScore ?? 0;
    const rb = b.rankScore ?? 0;
    if (ra !== rb) return rb - ra;
    const rva = a.relativeVolume ?? 0;
    const rvb = b.relativeVolume ?? 0;
    if (rva !== rvb) return rvb - rva;
    const mtfA = a.mtfSummary?.toLowerCase().includes('bullish') ? 1 : 0;
    const mtfB = b.mtfSummary?.toLowerCase().includes('bullish') ? 1 : 0;
    return mtfB - mtfA;
  });
}
