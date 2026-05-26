import { Injectable } from '@angular/core';
import { LabelLayout } from './label-collision.service';

const PRIORITY_SHOW_ZOOMED_OUT = 5;

@Injectable({ providedIn: 'root' })
export class OverlayVisibilityService {
  /** visibleBars > threshold → zoomed out, hide tertiary overlays */
  isZoomedOut(visibleBars: number): boolean {
    return visibleBars > 72;
  }

  filterLabels(layouts: LabelLayout[], zoomedOut: boolean): LabelLayout[] {
    if (!zoomedOut) return layouts;
    return layouts.map(l => ({
      ...l,
      opacity: l.priority <= PRIORITY_SHOW_ZOOMED_OUT ? l.opacity : l.opacity * 0.25,
      shortLabel: l.priority > 3 ? '' : l.shortLabel
    })).filter(l => l.shortLabel.length > 0 || l.priority <= 3);
  }

  shouldShowLevel(label: string, zoomedOut: boolean): boolean {
    if (!zoomedOut) return true;
    const tertiary = ['Prev', 'Invalid', 'EXT', 'VWAP'];
    return !tertiary.includes(label);
  }
}
