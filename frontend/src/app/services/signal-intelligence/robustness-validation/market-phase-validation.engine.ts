import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { avgR, winRate } from './robustness-validation.util';

/** Time-segment stability — recent vs full 60D concentration. */
export class MarketPhaseValidationEngine {
  /** Week concentration: if >50% of samples in one week, flag time bias. */
  weekConcentration(signals: SignalSnapshot[]): number {
    const weeks = new Map<string, number>();
    for (const s of signals) {
      const d = new Date(s.timestamp);
      const week = `${d.getFullYear()}-W${Math.ceil((d.getDate()) / 7)}-${d.getMonth()}`;
      weeks.set(week, (weeks.get(week) ?? 0) + 1);
    }
    const max = Math.max(...weeks.values(), 0);
    return signals.length ? (max / signals.length) * 100 : 100;
  }

  recentOnlyBias(signals: SignalSnapshot[]): boolean {
    if (signals.length < 5) return false;
    const sorted = signals.slice().sort((a, b) => b.timestamp - a.timestamp);
    const recentHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
    const recentAvg = avgR(recentHalf);
    const fullAvg = avgR(signals);
    return recentAvg > fullAvg * 1.5 && this.weekConcentration(signals) > 45;
  }

  timeRobustnessScore(signals: SignalSnapshot[]): number {
    const conc = this.weekConcentration(signals);
    if (conc > 60) return 30;
    if (conc > 45) return 50;
    if (conc > 35) return 65;
    return 80;
  }
}
