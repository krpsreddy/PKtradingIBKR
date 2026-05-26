import { Injectable } from '@angular/core';
import { LabelLayout } from './label-collision.service';
import { clampOpacity } from '../utils/readability-floors.util';

export interface AxisResolveOptions {
  failureMode: boolean;
  minGapPx: number;
  chartHeight: number;
  topExclusionPx?: number;
}

export interface ResolvedAxisLabel extends LabelLayout {
  resolvedY: number;
  visible: boolean;
}

const LABEL_RANK: Record<string, number> = {
  Stop: 0,
  Invalid: 1,
  Entry: 2,
  'Entry+': 2,
  Target: 3,
  Trigger: 4,
  Prev: 5,
  VWAP: 6
};

@Injectable({ providedIn: 'root' })
export class AxisLabelResolutionService {
  resolve(
    items: LabelLayout[],
    yOf: (price: number) => number | null,
    opts: AxisResolveOptions
  ): ResolvedAxisLabel[] {
    const gap = Math.max(22, opts.minGapPx);
    const topFloor = 10 + (opts.topExclusionPx ?? 0);
    const placed: ResolvedAxisLabel[] = [];

    const ranked = [...items].map(item => ({
      layout: item,
      rank: LABEL_RANK[item.label] ?? 9,
      shortLabel: opts.failureMode && item.label === 'Invalid' ? 'RISK' : item.shortLabel
    })).sort((a, b) => a.rank - b.rank || a.layout.price - b.layout.price);

    for (const { layout: item, rank, shortLabel } of ranked) {
      const baseY = yOf(item.price);
      if (baseY == null) continue;

      let resolvedY = baseY + item.offsetPx;
      let visible = true;

      for (const prev of placed) {
        if (!prev.visible) continue;
        const dist = Math.abs(resolvedY - prev.resolvedY);
        if (dist < gap) {
          resolvedY = prev.resolvedY + (resolvedY >= prev.resolvedY ? gap : -gap);
        }
      }

      if (resolvedY < topFloor || resolvedY > opts.chartHeight - 10) {
        if (rank >= 3 && !opts.failureMode) {
          visible = false;
        } else {
          resolvedY = Math.max(topFloor + 2, Math.min(opts.chartHeight - 12, resolvedY));
        }
      }

      if (opts.failureMode && rank >= 3) {
        for (const prev of placed) {
          const prevRank = LABEL_RANK[prev.label] ?? 9;
          if (prevRank <= 1 && Math.abs(resolvedY - prev.resolvedY) < gap) {
            visible = false;
            resolvedY = prev.resolvedY + gap * 2;
          }
        }
      }

      const tier = rank <= 1 ? 'critical' : rank <= 3 ? 'secondary' : 'peripheral';
      placed.push({
        ...item,
        shortLabel,
        resolvedY,
        visible,
        opacity: clampOpacity(item.opacity, tier)
      });
    }

    return placed;
  }
}
