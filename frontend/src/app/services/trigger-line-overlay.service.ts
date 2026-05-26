import { Injectable } from '@angular/core';
import { ChartExecutionLevel } from '../models/execution.model';
import { IndicatorSnapshot } from '../models/indicator.model';

export interface TriggerLine {
  price: number;
  label: string;
  kind: 'BREAKOUT' | 'RECLAIM' | 'FAIL';
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class TriggerLineOverlayService {
  build(
    signalType: string | null | undefined,
    price: number | null,
    indicators: IndicatorSnapshot | null,
    livePrice: number | null
  ): TriggerLine | null {
    if (!signalType || signalType === 'WATCH' || price == null) return null;
    const px = livePrice ?? price;
    const t = signalType.toUpperCase();

    if (t.includes('CONT') || t.includes('MOM') || t.includes('OPEN_MOM') || t.includes('SCOUT')) {
      const trigger = Math.max(px, indicators?.ema9 ?? px) * 1.002;
      return {
        price: round2(trigger),
        label: `BREAKOUT ABOVE ${round2(trigger)}`,
        kind: 'BREAKOUT',
        active: px >= trigger * 0.998
      };
    }
    if (t.includes('VWAP') || t.includes('PULL')) {
      const vwap = indicators?.vwap ?? px;
      return {
        price: round2(vwap),
        label: `VWAP RECLAIM ${round2(vwap)}`,
        kind: 'RECLAIM',
        active: px >= vwap
      };
    }
    if (t.includes('FAIL') || t.includes('IMBALANCE_DOWN')) {
      const trigger = Math.min(px, indicators?.vwap ?? px) * 0.998;
      return {
        price: round2(trigger),
        label: `FAIL BELOW ${round2(trigger)}`,
        kind: 'FAIL',
        active: px <= trigger * 1.002
      };
    }
    return null;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
