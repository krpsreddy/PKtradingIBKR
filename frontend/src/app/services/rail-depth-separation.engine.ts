import { Injectable } from '@angular/core';

export interface RailDepthInput {
  executionRailActive?: boolean;
}

export interface RailDepthSnapshot {
  chartRailGapPx: number;
  opticalFloorHeightPx: number;
  volumeFadeBandPx: number;
  timestampCorridorPx: number;
  tertiaryAnchorPx: number;
  cssVars: Record<string, string>;
}

const TIMESTAMP_CORRIDOR_PX = 34;
const RAIL_BOTTOM_PX = 72;
const VOLUME_FADE_BAND_PX = 72;
const TRADE_CHART_LANE_PX = 140;

@Injectable({ providedIn: 'root' })
export class RailDepthSeparationEngine {
  resolve(input: RailDepthInput = {}): RailDepthSnapshot {
    const chartRailGapPx = RAIL_BOTTOM_PX;
    const opticalFloorHeightPx = 12;
    const volumeFadeBandPx = VOLUME_FADE_BAND_PX;
    const timestampCorridorPx = TIMESTAMP_CORRIDOR_PX;
    const tertiaryClearancePx = 18;
    const tertiaryLiftPx = 7;
    const tertiaryAnchorPx = tertiaryClearancePx + timestampCorridorPx + tertiaryLiftPx;
    const bottomPad = input.executionRailActive
      ? tertiaryAnchorPx + 12
      : tertiaryAnchorPx;

    const cssVars: Record<string, string> = {
      '--rail-depth-gap': `${chartRailGapPx}px`,
      '--rail-optical-floor-h': `${opticalFloorHeightPx}px`,
      '--rail-volume-fade': `${volumeFadeBandPx}px`,
      '--timestamp-corridor': `${timestampCorridorPx}px`,
      '--timestamp-dead-zone': `${timestampCorridorPx}px`,
      '--tertiary-lift': `${tertiaryLiftPx}px`,
      '--tertiary-anchor': `${tertiaryAnchorPx}px`,
      '--tertiary-bottom-pad': `${bottomPad}px`,
      '--tertiary-clearance': `${tertiaryClearancePx}px`,
      '--trade-chart-rail-lane': `${TRADE_CHART_LANE_PX}px`,
      '--execution-rail-bottom': `${RAIL_BOTTOM_PX}px`,
      '--volume-region-margin': `${VOLUME_FADE_BAND_PX}px`,
      '--rail-substrate': 'rgba(11, 14, 20, 0.94)',
      '--rail-depth-cutoff': 'rgba(19, 23, 34, 0.72)'
    };

    return {
      chartRailGapPx,
      opticalFloorHeightPx,
      volumeFadeBandPx,
      timestampCorridorPx,
      tertiaryAnchorPx,
      cssVars
    };
  }
}
