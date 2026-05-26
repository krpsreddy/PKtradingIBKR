import { Injectable } from '@angular/core';
import { decayPresence } from '../utils/readability-floors.util';

export interface TemporalDecayInput {
  barsSinceSignal: number | null;
  signalAgeMinutes: number | null;
  momentumLoss: boolean;
  rvolCollapse: boolean;
  trustDeteriorating: boolean;
  staleSetup: boolean;
  staleTrigger: boolean;
  rankIndex: number;
  failed: boolean;
  nearTrigger: boolean;
}

export interface TemporalDecaySnapshot {
  triggerOpacity: number;
  rowOpacity: number;
  momentumOpacity: number;
  setupOpacity: number;
  globalForget: number;
}

@Injectable({ providedIn: 'root' })
export class TemporalDecayFieldEngine {
  resolve(input: TemporalDecayInput): TemporalDecaySnapshot {
    let forget = 1;
    const ageMin = input.signalAgeMinutes ?? 0;
    const bars = input.barsSinceSignal ?? 0;

    if (ageMin > 60) forget *= 0.62;
    else if (ageMin > 40) forget *= 0.72;
    else if (ageMin > 25) forget *= 0.82;
    else if (ageMin > 15) forget *= 0.9;

    if (bars > 30) forget *= 0.72;
    else if (bars > 18) forget *= 0.85;

    if (input.momentumLoss) forget *= 0.82;
    if (input.rvolCollapse) forget *= 0.78;
    if (input.trustDeteriorating) forget *= 0.85;
    if (input.staleSetup) forget *= 0.75;
    if (input.failed) forget *= 0.65;

    forget = Math.max(0.42, Math.min(1, forget));

    const triggerOpacity = input.nearTrigger
      ? decayPresence(0.95, forget, 'critical')
      : input.staleTrigger
        ? decayPresence(0.65, forget, 'secondary')
        : decayPresence(0.72, forget, 'secondary');

    let rowBase = input.rankIndex === 0 ? 1 : input.rankIndex === 1 ? 0.78 : input.rankIndex === 2 ? 0.62 : 0.45;
    if (input.staleSetup) rowBase *= 0.82;
    if (input.failed) rowBase *= 0.72;
    const rowTier = input.rankIndex === 0 ? 'secondary' : 'sidebarInactive';
    const rowOpacity = decayPresence(rowBase, forget, rowTier);

    return {
      triggerOpacity,
      rowOpacity,
      momentumOpacity: decayPresence(input.momentumLoss ? 0.65 : 0.88, forget, 'secondary'),
      setupOpacity: decayPresence(input.staleSetup ? 0.68 : 0.92, forget, 'secondary'),
      globalForget: forget
    };
  }
}
