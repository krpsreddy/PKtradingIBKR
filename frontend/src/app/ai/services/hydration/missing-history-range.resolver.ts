import {
  HYDRATION_TARGET_SESSION_DAYS,
  MissingHistoryRange,
  SymbolHistoryCoverage,
  SymbolHistoryHydrationState
} from './symbol-history-hydration.models';

const MS_DAY = 86_400_000;

/** Determines exact missing history windows — deterministic, no reload of existing data. */
export class MissingHistoryRangeResolver {

  resolve(
    coverage: SymbolHistoryCoverage,
    hydration: SymbolHistoryHydrationState,
    targetDays = 60,
    force = false,
    effectiveEvaluatedDates?: string[]
  ): { skip: boolean; missingRanges: MissingHistoryRange[]; reason?: string } {
    if (!force && this.shouldSkip(coverage, hydration, targetDays, effectiveEvaluatedDates)) {
      return { skip: true, missingRanges: [], reason: 'Fully hydrated — skipping' };
    }

    const targetStart = Date.now() - targetDays * MS_DAY;
    const ranges: MissingHistoryRange[] = [];

    if (!coverage.earliestTimestamp || coverage.totalCandles === 0) {
      ranges.push({
        start: targetStart,
        end: Date.now(),
        label: `Full ${targetDays}D window`
      });
      return { skip: false, missingRanges: ranges };
    }

    const earliest = new Date(coverage.earliestTimestamp).getTime();
    const latest = new Date(coverage.latestTimestamp ?? coverage.earliestTimestamp).getTime();

    if (earliest > targetStart + MS_DAY) {
      ranges.push({
        start: targetStart,
        end: earliest - 1,
        label: `Older history before ${coverage.earliestTimestamp?.slice(0, 10)}`
      });
    }

    if (coverage.loadedSessionDays < HYDRATION_TARGET_SESSION_DAYS) {
      ranges.push({
        start: Math.min(earliest, targetStart),
        end: Date.now(),
        label: `Incomplete coverage (${coverage.loadedSessionDays}/${HYDRATION_TARGET_SESSION_DAYS} session days)`
      });
    }

    const unevaluated = coverage.sessionDates.filter(
      d => !hydration.evaluatedSessionDates.includes(d)
    );
    if (unevaluated.length > 0 && ranges.length === 0) {
      ranges.push({
        start: new Date(unevaluated[0]).getTime(),
        end: new Date(unevaluated[unevaluated.length - 1]).getTime() + MS_DAY,
        label: `${unevaluated.length} sessions need replay evaluation`
      });
    }

    return { skip: false, missingRanges: this.dedupeRanges(ranges) };
  }

  private shouldSkip(
    coverage: SymbolHistoryCoverage,
    hydration: SymbolHistoryHydrationState,
    targetDays: number,
    effectiveEvaluatedDates?: string[]
  ): boolean {
    const evaluatedDates = effectiveEvaluatedDates ?? hydration.evaluatedSessionDates;
    const loadedDays = Math.max(hydration.loadedDays, coverage.loadedSessionDays);
    const candlesReady = coverage.fullyLoaded || loadedDays >= Math.min(HYDRATION_TARGET_SESSION_DAYS, targetDays * 0.65);

    if (!candlesReady) return false;
    if (hydration.missingRanges.length > 0 && hydration.hydrationStatus !== 'READY') return false;

    const unevaluated = coverage.sessionDates.filter(d => !evaluatedDates.includes(d));
    if (unevaluated.length > 0) return false;

    const replayDone = hydration.replayEvaluated || evaluatedDates.length > 0;
    if (!replayDone) return false;

    // Skip when candles + replay are complete, even if hydrationStatus was lost from localStorage.
    return hydration.hydrationStatus === 'READY'
      || (evaluatedDates.length > 0 && loadedDays >= Math.min(HYDRATION_TARGET_SESSION_DAYS, targetDays * 0.65));
  }

  private dedupeRanges(ranges: MissingHistoryRange[]): MissingHistoryRange[] {
    if (ranges.length <= 1) return ranges;
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const out: MissingHistoryRange[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = out[out.length - 1];
      const cur = sorted[i];
      if (cur.start <= prev.end + MS_DAY) {
        out[out.length - 1] = {
          ...prev,
          end: Math.max(prev.end, cur.end),
          label: `${prev.label}; ${cur.label}`
        };
      } else {
        out.push(cur);
      }
    }
    return out;
  }
}
