import { Injectable } from '@angular/core';
import { ChartFocusMode } from './price-action-focus.engine';

export interface CompressionInput {
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

export interface CompressionPlan {
  visibleFrom: number;
  visibleTo: number;
  priceMin: number | null;
  priceMax: number | null;
  scaleMargins: { top: number; bottom: number };
  rightOffset: number;
}

/** Compresses vertical range so recent candles occupy ~55–70% of plot height. */
@Injectable({ providedIn: 'root' })
export class PriceActionCompressionService {
  private static readonly RECENT_BARS = 20;
  /** Target candle body fraction of visible plot (0.55–0.70). */
  private static readonly CANDLE_FILL = 0.625;

  resolve(input: CompressionInput): CompressionPlan {
    const count = input.candleCount;
    let visibleBars = 50;

    if (input.focusMode === 'TODAY') {
      visibleBars = Math.min(60, Math.max(40, Math.floor(count * 0.55)));
    } else if (input.focusMode === 'MULTI_DAY') {
      visibleBars = Math.min(75, Math.max(45, Math.floor(count * 0.38)));
    } else if (input.replayIndex >= 0) {
      visibleBars = 48;
    }

    let from = Math.max(0, count - visibleBars);
    let to = count + 2;

    if (input.focusMode === 'REPLAY' && input.replayIndex >= 0) {
      const center = input.replayIndex;
      from = Math.max(0, center - 32);
      to = Math.min(count + 2, center + 18);
    }

    const pad = 0.008;
    let priceMin: number | null = null;
    let priceMax: number | null = null;

    if (input.hasActiveSetup) {
      const corridor = [input.entryPrice, input.targetPrice, input.triggerPrice, input.livePrice]
        .filter((p): p is number => p != null);
      const risk = [input.stopPrice, input.entryPrice]
        .filter((p): p is number => p != null);
      if (corridor.length >= 1 && risk.length >= 1) {
        priceMin = Math.min(...risk, ...corridor) * (1 - pad);
        priceMax = Math.max(...corridor, input.targetPrice ?? 0) * (1 + pad);
      } else if (corridor.length >= 2) {
        priceMin = Math.min(...corridor) * (1 - pad);
        priceMax = Math.max(...corridor) * (1 + pad);
      }
    }

    if (priceMin == null && count > 0) {
      const recentStart = Math.max(0, count - PriceActionCompressionService.RECENT_BARS);
      const highs = input.candleHighs.slice(recentStart);
      const lows = input.candleLows.slice(recentStart);
      if (highs.length) {
        const hi = Math.max(...highs);
        const lo = Math.min(...lows);
        const span = Math.max(hi - lo, hi * 0.0012);
        const fill = PriceActionCompressionService.CANDLE_FILL;
        const padEach = (span * (1 - fill)) / (2 * fill);
        priceMin = lo - padEach;
        priceMax = hi + padEach;
      }
    }

    return {
      visibleFrom: from,
      visibleTo: to,
      priceMin,
      priceMax,
      scaleMargins: { top: 0.12, bottom: 0.10 },
      rightOffset: 3
    };
  }
}
