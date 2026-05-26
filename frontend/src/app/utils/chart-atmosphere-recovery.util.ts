/** Final polish — chart history and atmosphere recovery (readability rebalance). */

export const HISTORY_OPACITY_FLOOR = 0.38;
export const HISTORICAL_CANDLE_FLOOR = 0.42;
export const VOLUME_OPACITY_FLOOR = 0.58;
export const LIVE_CANDLE_OPACITY = 1;
export const FOG_ATTENUATION = 0.72;
export const LOWER_FOG_ATTENUATION = 0.24;
export const RAIL_LANE_HEIGHT_PX = 68;
export const TIME_AXIS_HEIGHT_PX = 34;
export const VOLUME_SCALE_TOP_SEPARATED = 0.88;
export const VOLUME_SCALE_TOP_DEFAULT = 0.84;
export const PLOT_BOTTOM_SEPARATED = 0.02;
export const PLOT_BOTTOM_DEFAULT = 0.08;
export const RAIL_FOG_STRENGTH = 0.62;
export const COMPOSITE_DARKNESS_CAP = 0.38;
export const BOTTOM_COMPOSITE_DARKNESS_CAP = 0.22;
export const CHART_LUMINANCE_BOOST = 1.08;
export const TRADE_CHART_RAIL_LANE_PX = 140;
export const EXECUTION_RAIL_BOTTOM_PX = 68;
export const CHART_TIME_AXIS_HEIGHT_PX = 34;
export const VOLUME_REGION_MARGIN_PX = 72;

export function attenuateFog(opacity: number): number {
  return opacity * FOG_ATTENUATION;
}

export function attenuateLowerFog(opacity: number): number {
  return opacity * LOWER_FOG_ATTENUATION;
}

export function attenuateRailFog(opacity: number): number {
  return opacity * RAIL_FOG_STRENGTH;
}

export function clampCompositeDarkness(darkness: number): number {
  return Math.min(darkness, COMPOSITE_DARKNESS_CAP);
}

export function clampBottomCompositeDarkness(darkness: number): number {
  return Math.min(darkness, BOTTOM_COMPOSITE_DARKNESS_CAP);
}

/** Age-based candle fade with institutional history floor. */
export function resolveHistoricalCandleFade(age: number, histFade: number, liveDom: number): number {
  const hist = Math.max(HISTORY_OPACITY_FLOOR, histFade);
  if (age <= 0) {
    return Math.min(LIVE_CANDLE_OPACITY, Math.max(liveDom, 0.92));
  }
  if (age <= 1) {
    return Math.max(HISTORICAL_CANDLE_FLOOR, 0.72 * liveDom + 0.2);
  }
  if (age <= 8) {
    return Math.max(HISTORICAL_CANDLE_FLOOR, 0.55 * hist + 0.15);
  }
  if (age <= 20) {
    return Math.max(HISTORICAL_CANDLE_FLOOR, 0.38 * hist + 0.12);
  }
  if (age <= 40) {
    return Math.max(HISTORICAL_CANDLE_FLOOR, 0.22 * hist + 0.2);
  }
  return Math.max(HISTORICAL_CANDLE_FLOOR, 0.1 * hist + 0.32);
}

export function resolveVolumeOpacity(isLive: boolean, liveZone: boolean, historyFade: number, volumeLiquidity: number, boost: number): number {
  if (isLive) {
    return Math.max(VOLUME_OPACITY_FLOOR, boost);
  }
  const base = liveZone
    ? 0.22 * Math.max(HISTORY_OPACITY_FLOOR, historyFade) * volumeLiquidity
    : 0.14 * Math.max(HISTORY_OPACITY_FLOOR, historyFade);
  return Math.max(VOLUME_OPACITY_FLOOR, base * boost);
}
