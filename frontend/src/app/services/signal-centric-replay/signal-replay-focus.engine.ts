import { Injectable } from '@angular/core';
import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { SignalCentricRow, SignalVisualTone } from './signal-centric-replay.models';
import { ReplaySignalJumpKind } from '../replay-workstation/replay-workstation.models';

const ENTRY_TYPES = new Set(['PULL_BUY', 'MOM_BUY', 'OPEN_MOM_BUY', 'CONT_BUY']);
const EXIT_TYPES = new Set(['EXIT', 'OPEN_FAIL', 'RECOVERY_FAIL']);
const TRAP_TYPES = new Set(['OPEN_FAIL', 'OPEN_FAIL_BREAK', 'OPEN_FAIL_READY', 'RECOVERY_FAIL', 'IMBALANCE_DOWN']);
const RECLAIM_TYPES = new Set(['PULL_READY', 'PULL_BUY', 'RECOVERY_FAIL_READY']);
const SECOND_LEG_TYPES = new Set(['CONT_READY', 'CONT_BUY']);

/** Visual focus zones and signal journey for replay highlight. */
@Injectable({ providedIn: 'root' })
export class SignalReplayFocusEngine {
  toneClass(tone: SignalVisualTone): string {
    return `tone-${tone}`;
  }

  toneForRow(row: SignalCentricRow): SignalVisualTone {
    return row.visualTone;
  }

  journeyFromHistory(history: ReplayHistory | null, cursorIndex: number): string[] {
    if (!history?.timeline?.length) return [];
    const cutoff = history.sessionCandles[cursorIndex]?.time;
    if (!cutoff) return history.timeline.slice(0, 5).map(e => this.label(e));
    const ms = new Date(cutoff).getTime();
    return history.timeline
      .filter(e => new Date(e.timestamp).getTime() <= ms)
      .slice(-6)
      .map(e => this.label(e));
  }

  jumpKindForAction(action: 'ENTRY' | 'EXIT' | 'FAILURE' | 'TRAP' | 'RECLAIM' | 'SECOND_LEG'): ReplaySignalJumpKind {
    switch (action) {
      case 'ENTRY': return 'NEXT_ENTRY';
      case 'EXIT': return 'NEXT_SIGNAL';
      case 'FAILURE': return 'NEXT_TRAP';
      case 'TRAP': return 'NEXT_TRAP';
      case 'RECLAIM': return 'NEXT_RECLAIM';
      case 'SECOND_LEG': return 'NEXT_SECOND_LEG';
      default: return 'NEXT_SIGNAL';
    }
  }

  findExitBar(history: ReplayHistory, entryIndex: number): number | null {
    const entryTime = history.sessionCandles[entryIndex]?.time;
    if (!entryTime) return null;
    const entryMs = new Date(entryTime).getTime();
    const exit = [...history.timeline]
      .filter(e => EXIT_TYPES.has(e.signalType) && new Date(e.timestamp).getTime() > entryMs)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
    return exit ? this.barForEvent(exit, history) : null;
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

  private label(e: ReplaySignalEvent): string {
    return (e.setupLabel ?? e.signalType ?? 'SIGNAL').replace(/_/g, ' ').toUpperCase();
  }
}

export { ENTRY_TYPES, EXIT_TYPES, TRAP_TYPES, RECLAIM_TYPES, SECOND_LEG_TYPES };
