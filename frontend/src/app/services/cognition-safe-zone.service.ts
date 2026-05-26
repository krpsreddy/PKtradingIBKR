import { Injectable } from '@angular/core';

export interface CognitionSafeZoneInput {
  pillCount: number;
  priceScaleWidthPx?: number;
}

export interface CognitionSafeZoneSnapshot {
  exclusionCorridorPx: number;
  columnRightPx: number;
  chartRightInsetPx: number;
  priceScaleMinWidthPx: number;
}

const DEFAULT_SCALE_W = 64;

@Injectable({ providedIn: 'root' })
export class CognitionSafeZoneService {
  resolve(input: CognitionSafeZoneInput): CognitionSafeZoneSnapshot {
    const scaleW = input.priceScaleWidthPx ?? DEFAULT_SCALE_W;
    const corridor = input.pillCount > 2 ? 40 : input.pillCount > 0 ? 34 : 32;
    const chartRightInsetPx = input.pillCount > 2 ? 14 : input.pillCount > 1 ? 8 : 0;
    const columnRightPx = scaleW + corridor;

    return {
      exclusionCorridorPx: corridor,
      columnRightPx,
      chartRightInsetPx,
      priceScaleMinWidthPx: scaleW + (input.pillCount > 2 ? 8 : 0)
    };
  }
}
