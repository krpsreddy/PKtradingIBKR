import { ReplaySignalEvent } from '../../models/replay.model';

export class HistoricalConvictionEngine {
  fromEvent(event: ReplaySignalEvent | null): number {
    if (!event) return 50;
    return Math.max(0, Math.min(100, Math.round(event.score ?? 50)));
  }
}
