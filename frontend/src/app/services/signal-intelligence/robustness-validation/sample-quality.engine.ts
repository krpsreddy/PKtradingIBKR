import { SignalSnapshot } from '../../../models/signal-intelligence.model';

/** Sample size and data quality gates. */
export class SampleQualityEngine {
  score(signals: SignalSnapshot[]): number {
    const n = signals.length;
    if (n < 10) return 20;
    if (n < 25) return 45;
    if (n < 50) return 65;
    if (n < 100) return 80;
    return 95;
  }

  lowConfidence(signals: SignalSnapshot[]): boolean {
    return signals.length < 25;
  }

  insufficient(signals: SignalSnapshot[]): boolean {
    return signals.length < 10;
  }
}
