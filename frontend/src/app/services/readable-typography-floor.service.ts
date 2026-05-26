import { Injectable } from '@angular/core';
import { fontRem } from '../utils/readability-floors.util';

export interface TypographyFloorSnapshot {
  cssVars: Record<string, string>;
}

/** Global minimum readable typography — never go below these sizes. */
export const TYPOGRAPHY_FLOOR_PX = {
  tertiary: 11,
  sidebarSecondary: 12,
  railLabel: 12,
  railStop: 15,
  cognitionPill: 11,
  timestamp: 12,
  primaryMin: 14,
  primaryMax: 16,
  secondaryMin: 12,
  secondaryMax: 13,
  tertiaryMin: 11,
  tertiaryMax: 12,
  valueMin: 13,
  exitNow: 17,
  guidanceMin: 12
} as const;

export const TYPOGRAPHY_OPACITY_FLOOR = {
  tertiary: 0.58,
  timestamp: 0.78,
  guidance: 0.52,
  sidebarSecondary: 0.72,
  sidebarInactive: 0.48,
  sidebarActionable: 1
} as const;

@Injectable({ providedIn: 'root' })
export class ReadableTypographyFloorService {
  resolve(): TypographyFloorSnapshot {
    const px = TYPOGRAPHY_FLOOR_PX;
    const op = TYPOGRAPHY_OPACITY_FLOOR;
    return {
      cssVars: {
        '--typo-primary-min': fontRem(px.primaryMin),
        '--typo-primary-max': fontRem(px.primaryMax),
        '--typo-secondary-min': fontRem(px.secondaryMin),
        '--typo-secondary-max': fontRem(px.secondaryMax),
        '--typo-tertiary-min': fontRem(px.tertiaryMin),
        '--typo-tertiary-max': fontRem(px.tertiaryMax),
        '--typo-rail-label': fontRem(px.railLabel),
        '--typo-rail-value-min': fontRem(px.valueMin),
        '--typo-rail-exit-now': fontRem(px.exitNow),
        '--typo-rail-stop': fontRem(px.railStop),
        '--typo-sidebar-secondary': fontRem(px.sidebarSecondary),
        '--typo-cognition-pill': fontRem(px.cognitionPill),
        '--typo-timestamp': fontRem(px.timestamp),
        '--typo-guidance-min': fontRem(px.guidanceMin),
        '--typo-tertiary-opacity': `${op.tertiary}`,
        '--typo-timestamp-opacity': `${op.timestamp}`,
        '--typo-guidance-opacity': `${op.guidance}`,
        '--typo-sidebar-secondary-opacity': `${op.sidebarSecondary}`,
        '--typo-sidebar-inactive-opacity': `${op.sidebarInactive}`,
        '--typo-sidebar-actionable-opacity': `${op.sidebarActionable}`,
        '--typo-tertiary-lh': '1.35',
        '--typo-sidebar-lh': '1.45',
        '--typo-rail-primary-min-h': '22px'
      }
    };
  }
}
