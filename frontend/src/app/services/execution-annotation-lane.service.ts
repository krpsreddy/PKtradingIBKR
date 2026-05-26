import { Injectable } from '@angular/core';
import { LabelLayout } from './label-collision.service';

export type AnnotationLaneId = 'live' | 'stop' | 'entry' | 'target' | 'breakout' | 'risk' | 'liquidity';

export interface AnnotatedLayout extends LabelLayout {
  laneId: AnnotationLaneId;
}

export interface CanvasAnnotationPlacement {
  laneId: AnnotationLaneId;
  y: number;
  label: string;
  visible: boolean;
  opacity: number;
}

const LANE_RANK: Record<AnnotationLaneId, number> = {
  live: 0,
  stop: 1,
  entry: 2,
  target: 3,
  breakout: 4,
  risk: 5,
  liquidity: 6
};

@Injectable({ providedIn: 'root' })
export class ExecutionAnnotationLaneService {
  readonly laneGapPx = 22;

  assignLane(label: string, shortLabel?: string, triggerText?: string | null): AnnotationLaneId {
    const u = (shortLabel ?? label).toUpperCase();
    const trig = (triggerText ?? '').toUpperCase();
    if (trig.includes('BREAKOUT') || u.includes('BREAKOUT') || label === 'Trigger') return 'breakout';
    if (label === 'Stop') return 'stop';
    if (label === 'Invalid' || u.includes('RISK')) return 'risk';
    if (label === 'Entry' || label === 'Entry+') return 'entry';
    if (label === 'Target') return 'target';
    if (label === 'Prev' || label === 'VWAP') return 'liquidity';
    return 'liquidity';
  }

  /** Pre-assign lane vertical offsets before axis resolution. */
  annotate(items: LabelLayout[], triggerLabel?: string | null): AnnotatedLayout[] {
    const laneUse = new Map<AnnotationLaneId, number>();
    const sorted = [...items].sort((a, b) => a.priority - b.priority || a.price - b.price);

    return sorted.map(item => {
      const laneId = this.assignLane(item.label, item.shortLabel, triggerLabel);
      const laneIndex = laneUse.get(laneId) ?? 0;
      laneUse.set(laneId, laneIndex + 1);
      const laneOffset = laneIndex * this.laneGapPx;
      return {
        ...item,
        laneId,
        offsetPx: item.offsetPx + laneOffset
      };
    });
  }

  /** Resolve canvas Y for trigger/breakout text avoiding occupied lanes. */
  placeCanvasLabel(
    baseY: number,
    laneId: AnnotationLaneId,
    occupied: number[]
  ): CanvasAnnotationPlacement {
    let y = baseY - 4;
    const rank = LANE_RANK[laneId];

    for (const oy of occupied) {
      if (Math.abs(y - oy) < this.laneGapPx) {
        y = oy + this.laneGapPx;
      }
    }

    for (const other of occupied) {
      if (Math.abs(y - other) < this.laneGapPx) {
        y = other + (y >= other ? this.laneGapPx : -this.laneGapPx);
      }
    }

    const visible = rank <= 4 || y > 12;
    return {
      laneId,
      y,
      label: '',
      visible,
      opacity: rank <= 2 ? 1 : rank <= 4 ? 0.88 : 0.58
    };
  }
}
