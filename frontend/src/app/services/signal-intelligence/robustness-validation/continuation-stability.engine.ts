import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { ContinuationPersistenceRow } from './robustness-validation.models';
import { avgR, mfeR } from './robustness-validation.util';
import { pct } from '../signal-intelligence.math';

/** Continuation persistence through pullbacks. */
export class ContinuationStabilityEngine {
  analyze(strategyName: string, signals: SignalSnapshot[]): ContinuationPersistenceRow {
    const cont = signals.filter(s => mfeR(s) >= 1);
    const hit2 = signals.filter(s => s.evaluation?.hit2R);
    const shallow = signals.filter(s => Math.abs(s.vwapDistance ?? 0) < 0.012);
    const shallowCont = shallow.filter(s => mfeR(s) >= 1);

    const continuationPct = pct(cont.length, signals.length);
    const hit2RPct = pct(hit2.length, signals.length);
    const pullbackHoldPct = shallow.length
      ? pct(shallowCont.length, shallow.length)
      : 0;

    return {
      strategyName,
      continuationPct,
      hit2RPct,
      avgMfeR: avgR(signals),
      pullbackHoldPct,
      stable: continuationPct >= 55 && hit2RPct >= 40
    };
  }

  quality(signals: SignalSnapshot[]): number {
    const row = this.analyze('', signals);
    let score = 40;
    if (row.continuationPct >= 65) score += 25;
    else if (row.continuationPct >= 50) score += 15;
    if (row.hit2RPct >= 50) score += 20;
    else if (row.hit2RPct >= 35) score += 10;
    if (row.pullbackHoldPct >= 55) score += 15;
    return Math.min(100, score);
  }
}
