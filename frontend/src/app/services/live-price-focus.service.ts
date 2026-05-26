import { Injectable } from '@angular/core';

export type FocusPulseMode = 'neutral' | 'active' | 'failure' | 'breakout';

export interface LivePriceFocusInput {
  tradeActive: boolean;
  failurePct: number | null;
  triggerNear: boolean;
  triggerActive: boolean;
  adaptiveExit: string | null;
  replayMode: boolean;
  calmMode: boolean;
}

@Injectable({ providedIn: 'root' })
export class LivePriceFocusService {
  resolve(input: LivePriceFocusInput): FocusPulseMode {
    if (input.replayMode || input.calmMode) return 'neutral';
    if (input.adaptiveExit?.includes('EXIT') || (input.failurePct ?? 0) >= 40) return 'failure';
    if (input.triggerNear && !input.triggerActive) return 'breakout';
    if (input.tradeActive || input.triggerActive) return 'active';
    return 'neutral';
  }
}
