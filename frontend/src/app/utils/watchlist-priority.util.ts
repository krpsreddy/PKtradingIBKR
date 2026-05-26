import { AttentionPriority } from '../models/execution.model';
import { TradingSymbol } from '../models/trading-symbol.model';
import { MarketTrend } from '../models/workspace.model';
import { computeAttentionPriority, priorityClass, priorityPulse } from './attention-priority.util';
import { toCandidateFromWatchlist } from './watchlist-candidate.util';

export interface WatchlistPriority {
  priority: AttentionPriority;
  score: number;
  cssClass: string;
  pulse: boolean;
  muted: boolean;
}

export function computeWatchlistPriority(item: TradingSymbol, marketTrend: MarketTrend | null, rankIndex = 99): WatchlistPriority {
  const candidate = toCandidateFromWatchlist(item);
  const result = computeAttentionPriority(candidate, marketTrend);
  const muted = result.priority === 'LOW' || item.lifecycleState === 'WEAKENING'
    || item.freshness === 'STALE' || item.freshness === 'AGING';
  const topRanked = rankIndex <= 1;
  return {
    priority: result.priority,
    score: result.score,
    cssClass: priorityClass(result.priority) + (muted || !topRanked ? ' watch-muted' : ' watch-emphasis'),
    pulse: topRanked && priorityPulse(result.priority, item.freshness),
    muted: muted || !topRanked
  };
}
