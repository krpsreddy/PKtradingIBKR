import { ReplayHistory } from '../../../models/replay.model';

/** Filter bulk replay sessions to only unevaluated dates — incremental evaluation. */
export function filterSessionsForReplay(
  sessions: ReplayHistory[],
  evaluatedDates: string[]
): ReplayHistory[] {
  const done = new Set(evaluatedDates);
  return sessions.filter(s => s.replayDate && !done.has(s.replayDate));
}
