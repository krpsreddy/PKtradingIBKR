import { Injectable } from '@angular/core';
import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { ReplaySignalJumpKind, ReplayStartMode } from './replay-workstation.models';

const ENTRY_TYPES = new Set(['PULL_BUY', 'MOM_BUY', 'OPEN_MOM_BUY', 'CONT_BUY']);
const RECLAIM_TYPES = new Set(['PULL_READY', 'PULL_BUY', 'RECOVERY_FAIL_READY']);
const SECOND_LEG_TYPES = new Set(['CONT_READY', 'CONT_BUY']);
const TRAP_TYPES = new Set(['OPEN_FAIL', 'OPEN_FAIL_BREAK', 'OPEN_FAIL_READY', 'RECOVERY_FAIL', 'IMBALANCE_DOWN']);

@Injectable({ providedIn: 'root' })
export class ReplayTimelineContextEngine {
  resolveStartIndex(history: ReplayHistory, mode: ReplayStartMode, customBarIndex?: number): number {
    const max = Math.max(0, history.sessionCandles.length - 1);
    switch (mode) {
      case 'OPEN':
        return 0;
      case 'FIRST_SIGNAL':
        return this.barForFirstEvent(history.timeline, history) ?? 0;
      case 'FIRST_ENTRY':
        return this.barForFirstMatching(history, e => ENTRY_TYPES.has(e.signalType)) ?? 0;
      case 'VWAP_RECLAIM':
        return this.barForFirstMatching(history, e => RECLAIM_TYPES.has(e.signalType)) ?? 0;
      case 'SECOND_LEG':
        return this.barForFirstMatching(history, e => SECOND_LEG_TYPES.has(e.signalType)) ?? 0;
      case 'CUSTOM_TIME':
        return customBarIndex != null ? Math.max(0, Math.min(customBarIndex, max)) : 0;
      case 'SMART':
      default:
        return this.smartStartIndex(history);
    }
  }

  smartStartIndex(history: ReplayHistory): number {
    const reclaim = this.barForFirstMatching(history, e => RECLAIM_TYPES.has(e.signalType));
    if (reclaim != null && reclaim > 0) return Math.max(0, reclaim - 3);
    const entry = this.barForFirstMatching(history, e => ENTRY_TYPES.has(e.signalType));
    if (entry != null && entry > 0) return Math.max(0, entry - 5);
    return this.barForFirstEvent(history.timeline, history) ?? 0;
  }

  findSignalJump(
    history: ReplayHistory,
    cursorIndex: number,
    kind: 'NEXT' | 'PREV',
    filter: (e: ReplaySignalEvent) => boolean
  ): number | null {
    const cursorTime = history.sessionCandles[cursorIndex]?.time;
    if (!cursorTime) return null;
    const cursorMs = new Date(cursorTime).getTime();
    const ordered = [...history.timeline].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    if (kind === 'NEXT') {
      const next = ordered.find(e => filter(e) && new Date(e.timestamp).getTime() > cursorMs);
      return next ? this.barForEvent(next, history) : null;
    }
    const prev = [...ordered].reverse().find(e => filter(e) && new Date(e.timestamp).getTime() < cursorMs);
    return prev ? this.barForEvent(prev, history) : null;
  }

  jumpNextSignal(history: ReplayHistory, cursor: number): number | null {
    return this.findSignalJump(history, cursor, 'NEXT', () => true);
  }

  jumpPrevSignal(history: ReplayHistory, cursor: number): number | null {
    return this.findSignalJump(history, cursor, 'PREV', () => true);
  }

  jumpNextEntry(history: ReplayHistory, cursor: number): number | null {
    return this.findSignalJump(history, cursor, 'NEXT', e => ENTRY_TYPES.has(e.signalType));
  }

  jumpNextTrap(history: ReplayHistory, cursor: number): number | null {
    return this.findSignalJump(history, cursor, 'NEXT', e => TRAP_TYPES.has(e.signalType));
  }

  jumpNextReclaim(history: ReplayHistory, cursor: number): number | null {
    return this.findSignalJump(history, cursor, 'NEXT', e => RECLAIM_TYPES.has(e.signalType));
  }

  jumpNextSecondLeg(history: ReplayHistory, cursor: number): number | null {
    return this.findSignalJump(history, cursor, 'NEXT', e => SECOND_LEG_TYPES.has(e.signalType));
  }

  jumpPrevEntry(history: ReplayHistory, cursor: number): number | null {
    return this.findSignalJump(history, cursor, 'PREV', e => ENTRY_TYPES.has(e.signalType));
  }

  jumpFirstSignal(history: ReplayHistory): number | null {
    const ordered = [...history.timeline].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const first = ordered[0];
    return first ? this.barForEvent(first, history) : null;
  }

  jumpLastSignal(history: ReplayHistory): number | null {
    const ordered = [...history.timeline].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const last = ordered[ordered.length - 1];
    return last ? this.barForEvent(last, history) : null;
  }

  jumpFirstEntry(history: ReplayHistory): number | null {
    return this.barForFirstMatching(history, e => ENTRY_TYPES.has(e.signalType));
  }

  jumpLastEntry(history: ReplayHistory): number | null {
    const ordered = [...history.timeline]
      .filter(e => ENTRY_TYPES.has(e.signalType))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const last = ordered[ordered.length - 1];
    return last ? this.barForEvent(last, history) : null;
  }

  jumpAtSessionStart(history: ReplayHistory, kind: ReplaySignalJumpKind): number | null {
    switch (kind) {
      case 'NEXT_ENTRY':
      case 'PREV_ENTRY':
        return this.jumpFirstEntry(history);
      case 'NEXT_TRAP':
        return this.barForFirstMatching(history, e => TRAP_TYPES.has(e.signalType));
      case 'NEXT_RECLAIM':
        return this.barForFirstMatching(history, e => RECLAIM_TYPES.has(e.signalType));
      case 'NEXT_SECOND_LEG':
        return this.barForFirstMatching(history, e => SECOND_LEG_TYPES.has(e.signalType));
      case 'PREV_SIGNAL':
      case 'NEXT_SIGNAL':
      default:
        return this.jumpFirstSignal(history);
    }
  }

  jumpAtSessionEnd(history: ReplayHistory, kind: ReplaySignalJumpKind): number | null {
    const lastBar = Math.max(0, history.sessionCandles.length - 1);
    switch (kind) {
      case 'PREV_ENTRY':
        return this.jumpLastEntry(history);
      case 'PREV_SIGNAL':
        return this.jumpPrevSignal(history, lastBar) ?? this.jumpLastSignal(history);
      case 'NEXT_ENTRY':
      case 'NEXT_TRAP':
      case 'NEXT_RECLAIM':
      case 'NEXT_SECOND_LEG':
      case 'NEXT_SIGNAL':
      default:
        return this.jumpLastSignal(history);
    }
  }

  private barForFirstEvent(events: ReplaySignalEvent[], history: ReplayHistory): number | null {
    if (!events.length) return null;
    return this.barForEvent(events[0], history);
  }

  private barForFirstMatching(history: ReplayHistory, filter: (e: ReplaySignalEvent) => boolean): number | null {
    const hit = history.timeline.find(filter);
    return hit ? this.barForEvent(hit, history) : null;
  }

  private barForEvent(event: ReplaySignalEvent, history: ReplayHistory): number | null {
    const targetMs = new Date(event.timestamp).getTime();
    let best = -1;
    let bestDelta = Number.MAX_SAFE_INTEGER;
    for (let i = 0; i < history.sessionCandles.length; i++) {
      const ms = new Date(history.sessionCandles[i].time).getTime();
      const delta = Math.abs(ms - targetMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    return best >= 0 ? best : null;
  }
}
