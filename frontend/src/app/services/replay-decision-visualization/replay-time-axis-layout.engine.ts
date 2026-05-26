import { Injectable } from '@angular/core';
import { DeepPartial, TimeScaleOptions } from 'lightweight-charts';
import { Time } from 'lightweight-charts';

export interface ReplayTimeAxisLayout {
  timeScale: DeepPartial<TimeScaleOptions>;
  priceScaleBottom: number;
  volumeScaleBottom: number;
  fontSize: number;
}

@Injectable({ providedIn: 'root' })
export class ReplayTimeAxisLayoutEngine {
  resolve(chartWidth: number, replayMode: boolean): ReplayTimeAxisLayout {
    const wide = chartWidth > 900;
    return {
      timeScale: {
        visible: true,
        timeVisible: true,
        secondsVisible: false,
        borderVisible: true,
        fixLeftEdge: false,
        fixRightEdge: false,
        barSpacing: wide ? 9 : 7,
        minBarSpacing: 3,
        rightOffset: 4
      },
      priceScaleBottom: replayMode ? 0.14 : 0.22,
      volumeScaleBottom: replayMode ? 0.14 : 0.12,
      fontSize: wide ? 12 : 11
    };
  }

  formatTick(time: Time, formatter: (t: Time) => string, barIndex: number, everyN: number): string {
    if (barIndex % everyN !== 0) return '';
    return formatter(time);
  }

  tickEveryN(chartWidth: number, barCount: number): number {
    const slots = Math.max(4, Math.floor(chartWidth / 88));
    return Math.max(1, Math.floor(barCount / slots));
  }
}
