/** Perception-safe opacity and typography floors. */

export const OPACITY_FLOOR = {
  critical: 0.96,
  secondary: 0.82,
  peripheral: 0.48,
  sidebarInactive: 0.46,
  sidebarSecondary: 0.68,
  sidebarActionable: 0.68,
  sidebarHover: 0.85,
  tertiary: 0.62,
  timestamp: 0.72,
  guidance: 0.48
} as const;

export const FONT_FLOOR_PX = {
  critical: 14,
  secondary: 12,
  tertiary: 11,
  railLabel: 12,
  railValue: 13,
  sidebarSecondary: 12,
  cognitionPill: 11,
  timestamp: 12,
  guidance: 11
} as const;

export function clampOpacity(value: number, tier: keyof typeof OPACITY_FLOOR): number {
  return Math.max(OPACITY_FLOOR[tier], Math.min(1, value));
}

/** Apply decay to presence while preserving readability floor. */
export function decayPresence(value: number, decay: number, tier: keyof typeof OPACITY_FLOOR): number {
  const faded = value * (0.55 + decay * 0.45);
  return clampOpacity(faded, tier);
}

export function fontRem(px: number): string {
  return `${px / 16}rem`;
}

export function clampFontPx(value: number, minPx: number): number {
  return Math.max(minPx, value);
}
