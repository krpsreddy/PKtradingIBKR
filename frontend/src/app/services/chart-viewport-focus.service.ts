import { Injectable } from '@angular/core';
import { ChartFocusMode } from './price-action-focus.engine';
import { CompressionInput, PriceActionCompressionService } from './price-action-compression.service';

export interface ViewportFocusInput extends Omit<CompressionInput, 'focusMode'> {
  replayMode: boolean;
  focusMode?: ChartFocusMode;
}

export interface ViewportFocusPlan {
  visibleFrom: number;
  visibleTo: number;
  priceMin: number | null;
  priceMax: number | null;
  scaleMargins: { top: number; bottom: number };
  rightOffset: number;
}

@Injectable({ providedIn: 'root' })
export class ChartViewportFocusService {
  constructor(private compression: PriceActionCompressionService) {}

  resolve(input: ViewportFocusInput): ViewportFocusPlan {
    const focusMode: ChartFocusMode = input.focusMode
      ?? (input.replayMode ? 'REPLAY' : 'TODAY');

    return this.compression.resolve({
      candleCount: input.candleCount,
      focusMode,
      replayIndex: input.replayIndex,
      hasActiveSetup: input.hasActiveSetup,
      entryPrice: input.entryPrice,
      stopPrice: input.stopPrice,
      targetPrice: input.targetPrice,
      triggerPrice: input.triggerPrice ?? null,
      livePrice: input.livePrice,
      candleHighs: input.candleHighs,
      candleLows: input.candleLows
    });
  }
}
