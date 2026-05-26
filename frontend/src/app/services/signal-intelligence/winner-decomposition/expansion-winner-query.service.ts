import { Injectable } from '@angular/core';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalIntelligenceFilter,
  SignalSnapshot
} from '../../../models/signal-intelligence.model';
import { SignalIntelligenceStore } from '../signal-intelligence.store';
import { isEvaluatedSignal } from '../signal-intelligence.math';
import {
  extractPreEntryEnvironment,
  isLargeWinner,
  isLowFakeoutRunner,
  mfeR,
  resultBucket,
  sessionDateFromTs
} from './winner-decomposition.util';
import { ExpansionWinner } from './winner-decomposition.models';

/** Query evaluated signals for large expansion winners (GT_2R+). */
@Injectable({ providedIn: 'root' })
export class ExpansionWinnerQueryService {

  constructor(private store: SignalIntelligenceStore) {}

  queryWinners(
    filter: SignalIntelligenceFilter = {},
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS
  ): SignalSnapshot[] {
    const fromTs = Date.now() - lookbackDays * 86_400_000;
    return this.store
      .query({ ...filter, fromTs })
      .filter(s => isEvaluatedSignal(s) && isLargeWinner(s))
      .sort((a, b) => mfeR(b) - mfeR(a));
  }

  queryLowFakeoutRunners(
    filter: SignalIntelligenceFilter = {},
    lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS
  ): SignalSnapshot[] {
    return this.queryWinners(filter, lookbackDays).filter(isLowFakeoutRunner);
  }

  querySessionWinners(symbol: string, sessionDate: string, lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS): SignalSnapshot[] {
    return this.queryWinners({ symbol: symbol.toUpperCase() }, lookbackDays)
      .filter(s => sessionDateFromTs(s.timestamp) === sessionDate);
  }

  toExpansionWinner(s: SignalSnapshot, sampleCount: number): ExpansionWinner {
    const preEntry = extractPreEntryEnvironment(s, sampleCount);
    const bucket = resultBucket(s);
    return {
      signal: s,
      preEntry,
      moveSizeR: mfeR(s),
      continuationPct: s.evaluation?.hit1R ? 100 : Math.round(Math.min(100, mfeR(s) * 40)),
      narrative: preEntry.narrative.path,
      resultBucket: bucket === 'GT_3R' ? 'GT_3R' : bucket === 'GT_2R' ? 'GT_2R' : 'WINNER',
      expansionEfficiency: Math.round((mfeR(s) / Math.max(1, mfeR(s))) * 100),
      bestEntryPrice: s.entryPrice,
      sessionMovePct: preEntry.indicators.extendedEntry ? 0 : Math.round(((s.evaluation?.maxPriceSeen ?? s.entryPrice) - s.entryPrice) / s.entryPrice * 1000) / 10
    };
  }
}
