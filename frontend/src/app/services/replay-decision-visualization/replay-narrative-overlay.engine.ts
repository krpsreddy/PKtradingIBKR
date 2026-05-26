import { Injectable } from '@angular/core';
import { ReplayHistory, ReplaySignalEvent } from '../../models/replay.model';
import { ReplayNarrativeBand } from './replay-decision-visualization.models';

const NARRATIVE_MAP: Record<string, { label: string; color: string }> = {
  OPEN_FAIL: { label: 'FAILED BREAKOUT', color: 'rgba(239, 83, 80, 0.08)' },
  OPEN_FAIL_BREAK: { label: 'FAILED BREAKOUT', color: 'rgba(239, 83, 80, 0.08)' },
  PULL_READY: { label: 'VWAP RECLAIM', color: 'rgba(34, 197, 94, 0.07)' },
  PULL_BUY: { label: 'ACCEPTANCE', color: 'rgba(34, 197, 94, 0.09)' },
  CONT_READY: { label: 'SECOND LEG', color: 'rgba(56, 189, 248, 0.08)' },
  CONT_BUY: { label: 'SECOND LEG', color: 'rgba(56, 189, 248, 0.1)' },
  MOM_BUY: { label: 'MOMENTUM CHASE', color: 'rgba(210, 170, 90, 0.07)' },
  EXIT: { label: 'EXHAUSTION', color: 'rgba(139, 148, 158, 0.08)' },
  IMBALANCE_DOWN: { label: 'LIQUIDITY TRAP', color: 'rgba(220, 38, 38, 0.07)' }
};

@Injectable({ providedIn: 'root' })
export class ReplayNarrativeOverlayEngine {
  buildBands(history: ReplayHistory): ReplayNarrativeBand[] {
    const bands: ReplayNarrativeBand[] = [];
    for (const event of history.timeline) {
      const meta = NARRATIVE_MAP[event.signalType];
      if (!meta) continue;
      const bar = this.barForEvent(event, history);
      if (bar == null) continue;
      bands.push({
        fromBar: Math.max(0, bar - 2),
        toBar: bar + 8,
        label: meta.label,
        color: meta.color
      });
    }
    return this.mergeBands(bands);
  }

  narrativeForEvent(event: ReplaySignalEvent): string {
    return NARRATIVE_MAP[event.signalType]?.label ?? event.setupLabel ?? event.signalType;
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

  private mergeBands(bands: ReplayNarrativeBand[]): ReplayNarrativeBand[] {
    if (!bands.length) return [];
    const sorted = [...bands].sort((a, b) => a.fromBar - b.fromBar);
    const out: ReplayNarrativeBand[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = out[out.length - 1];
      const cur = sorted[i];
      if (cur.label === prev.label && cur.fromBar <= prev.toBar + 2) {
        prev.toBar = Math.max(prev.toBar, cur.toBar);
      } else {
        out.push(cur);
      }
    }
    return out.slice(0, 12);
  }
}
