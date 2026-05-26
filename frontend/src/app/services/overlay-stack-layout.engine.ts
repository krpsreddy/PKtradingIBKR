import { Injectable } from '@angular/core';
import { clampOpacity, OPACITY_FLOOR } from '../utils/readability-floors.util';

export interface StackItem {
  id: string;
  label: string;
  priority: number;
  tone: string;
}

export interface StackLayoutItem extends StackItem {
  visible: boolean;
  opacity: number;
}

const MIN_GAP_PX = 22;

@Injectable({ providedIn: 'root' })
export class OverlayStackLayoutEngine {
  readonly minGapPx = MIN_GAP_PX;

  layout(items: StackItem[], maxVisible = 3): StackLayoutItem[] {
    if (!items.length) return [];

    const sorted = [...items].sort((a, b) => a.priority - b.priority);
    const tiers: Array<keyof typeof OPACITY_FLOOR> = ['critical', 'secondary', 'peripheral'];

    return sorted.slice(0, maxVisible).map((item, index) => ({
      ...item,
      visible: true,
      opacity: clampOpacity(
        index === 0 ? 0.96 : index === 1 ? 0.82 : Math.max(0.62, 0.68),
        tiers[Math.min(index, tiers.length - 1)]
      )
    }));
  }

  pillPriority(label: string): number {
    const u = label.toUpperCase();
    if (u.includes('EXIT')) return 0;
    if (u.includes('FAILURE') || u.includes('FAIL')) return 1;
    if (u.includes('THETA')) return 2;
    if (u.includes('WEAK')) return 3;
    if (u.includes('TRIGGER') || u.includes('NEAR')) return 4;
    if (u.includes('RVOL')) return 5;
    return 6;
  }
}
