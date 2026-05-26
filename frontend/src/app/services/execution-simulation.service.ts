import { Injectable } from '@angular/core';
import { ProbabilisticExecutionSnapshot } from '../models/probabilistic.model';

export interface ExecutionSimulation {
  premiumMove: string;
  holdWindow: string;
  strikeBias: string;
  avoid: string | null;
  pathLabel: string;
}

@Injectable({ providedIn: 'root' })
export class ExecutionSimulationService {
  simulate(probabilistic: ProbabilisticExecutionSnapshot | null): ExecutionSimulation | null {
    const opt = probabilistic?.optionsExecution;
    if (!opt) return null;

    return {
      premiumMove: opt.expectedPremiumExpansion ?? opt.expectedPremiumDeterioration ?? '—',
      holdWindow: opt.holdWindow?.replace(' optimal', '') ?? '—',
      strikeBias: opt.strikeGuidance?.split('·')[0]?.trim() ?? 'ATM',
      avoid: opt.avoidReason ?? (opt.recommendedStrikeType === 'AVOID_OTM' ? 'OTM lotto contracts' : null),
      pathLabel: opt.expectedMoveVelocity ?? 'MODERATE'
    };
  }
}
