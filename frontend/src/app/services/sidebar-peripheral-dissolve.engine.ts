import { Injectable } from '@angular/core';

export interface SidebarDissolveInput {
  chopMode: boolean;
  actionable: boolean;
  hoveredOrFocused: boolean;
  rankIndex: number;
  baseOpacity: number;
}

export interface SidebarDissolveSnapshot {
  opacity: number;
  restoreOnHover: boolean;
}

@Injectable({ providedIn: 'root' })
export class SidebarPeripheralDissolveEngine {
  resolve(input: SidebarDissolveInput): SidebarDissolveSnapshot {
    if (!input.chopMode) {
      return { opacity: input.baseOpacity, restoreOnHover: false };
    }

    if (input.hoveredOrFocused) {
      return {
        opacity: Math.max(0.72, input.baseOpacity),
        restoreOnHover: true
      };
    }

    if (input.actionable) {
      const rankDamp = Math.min(input.rankIndex, 3) * 0.03;
      const o = 0.78 - rankDamp;
      return {
        opacity: Math.max(0.68, Math.min(0.86, o)),
        restoreOnHover: true
      };
    }

    const rankLift = Math.min(input.rankIndex, 4) * 0.015;
    const o = 0.46 + rankLift;
    return {
      opacity: Math.max(0.46, Math.min(0.54, o)),
      restoreOnHover: true
    };
  }
}
