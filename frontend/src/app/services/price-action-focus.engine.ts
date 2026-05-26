import { Injectable } from '@angular/core';

export type ChartFocusMode = 'TODAY' | 'MULTI_DAY' | 'REPLAY';

export interface PriceActionFocusInput {
  candleCount: number;
  focusMode: ChartFocusMode;
  replayIndex: number;
  hasActiveSetup: boolean;
  entryPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  triggerPrice: number | null;
  livePrice: number | null;
  candleHighs: number[];
  candleLows: number[];
}

export interface PriceActionFocusPlan {
  visibleFrom: number;
  visibleTo: number;
  priceMin: number | null;
  priceMax: number | null;
  scaleMargins: { top: number; bottom: number };
  rightBias: number;
}

/** Biases viewport toward actionable recent structure (~70% recent candles). */
@Injectable({ providedIn: 'root' })
export class PriceActionFocusEngine {
  resolve(input: PriceActionFocusInput): PriceActionFocusPlan {
    const count = input.candleCount;
    let visibleBars = 60;

    if (input.focusMode === 'TODAY') {
      visibleBars = Math.min(70, Math.max(45, count));
    } else if (input.focusMode === 'MULTI_DAY') {
      visibleBars = Math.min(90, Math.max(55, Math.floor(count * 0.45)));
    } else if (input.replayIndex >= 0) {
      visibleBars = 55;
    }

    let from = Math.max(0, count - visibleBars);
    let to = count + 1;

    if (input.focusMode === 'REPLAY' && input.replayIndex >= 0) {
      const center = input.replayIndex;
      from = Math.max(0, center - 35);
      to = Math.min(count + 1, center + 20);
    }

    let priceMin: number | null = null;
    let priceMax: number | null = null;
    const pad = 0.012;

    const actionPrices = [
      input.entryPrice,
      input.stopPrice,
      input.targetPrice,
      input.triggerPrice,
      input.livePrice
    ].filter((p): p is number => p != null);

    if (input.hasActiveSetup && actionPrices.length >= 2) {
      priceMin = Math.min(...actionPrices) * (1 - pad);
      priceMax = Math.max(...actionPrices) * (1 + pad);
    } else if (count > 0) {
      const start = Math.max(0, count - visibleBars);
      const highs = input.candleHighs.slice(start);
      const lows = input.candleLows.slice(start);
      if (highs.length) {
        priceMin = Math.min(...lows) * (1 - pad);
        priceMax = Math.max(...highs) * (1 + pad);
      }
    }

    return {
      visibleFrom: from,
      visibleTo: to,
      priceMin,
      priceMax,
      scaleMargins: { top: 0.12, bottom: 0.12 },
      rightBias: 0.7
    };
  }
}
