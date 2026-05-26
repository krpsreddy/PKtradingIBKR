import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { SymbolHistoryCoverage, SymbolHistoryHydrationState } from './symbol-history-hydration.models';

/** ET session date for hydration bookkeeping — matches backend coverage format (YYYY-MM-DD). */
export function sessionDateFromTs(ts: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(ts));
}

/** Derive which session dates already have evaluated signals in the local store. */
export function evaluatedSessionDatesFromSignals(signals: SignalSnapshot[]): string[] {
  const dates = new Set<string>();
  for (const s of signals) {
    if (!s.evaluation?.evaluated || s.evaluation.status === 'OPEN') continue;
    dates.add(sessionDateFromTs(s.timestamp));
  }
  return [...dates].sort();
}

export function mergeEvaluatedSessionDates(
  hydration: SymbolHistoryHydrationState,
  signalDates: string[]
): string[] {
  return [...new Set([...hydration.evaluatedSessionDates, ...signalDates])].sort();
}

/** Reconcile frontend hydration metadata from persisted signals + backend coverage. */
export function reconcileHydrationState(
  hydration: SymbolHistoryHydrationState,
  coverage: SymbolHistoryCoverage,
  signalDates: string[],
  targetDays: number
): Partial<SymbolHistoryHydrationState> {
  const evaluatedSessionDates = mergeEvaluatedSessionDates(hydration, signalDates);
  const evaluatedCount = signalDates.length;
  const patch: Partial<SymbolHistoryHydrationState> = {
    evaluatedSessionDates,
    signalCount: Math.max(hydration.signalCount, evaluatedCount),
    loadedDays: Math.max(hydration.loadedDays, coverage.loadedSessionDays),
    targetDays: hydration.targetDays || targetDays
  };

  if (evaluatedCount > 0) {
    patch.replayEvaluated = true;
  }

  const unevaluated = coverage.sessionDates.filter(d => !evaluatedSessionDates.includes(d));
  const candlesReady = coverage.fullyLoaded || coverage.loadedSessionDays >= Math.min(39, targetDays * 0.65);

  if (candlesReady && unevaluated.length === 0 && evaluatedSessionDates.length > 0) {
    patch.hydrationStatus = 'READY';
    patch.queueState = 'SKIPPED';
    patch.missingRanges = [];
    patch.replayEvaluated = true;
  } else if (candlesReady && evaluatedCount > 0 && hydration.hydrationStatus === 'NOT_STARTED') {
    patch.hydrationStatus = 'PARTIAL';
  }

  return patch;
}
