import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { ContinuationHealth } from './trade-lifecycle.models';
import { windowAt } from './trade-lifecycle.util';

/** Continuation health from momentum persistence, pullback depth, volume, breadth proxies. */
export class ContinuationHealthEngine {

  evaluate(signal: SignalSnapshot): ContinuationHealth {
    const ev = signal.evaluation;
    if (!ev?.evaluated) return 'MODERATE';

    const w5 = windowAt(ev, 5);
    const w15 = windowAt(ev, 15);
    const w30 = windowAt(ev, 30);

    let score = 50;

    // Momentum persistence — window progression
    const prog5 = w5?.mfeR ?? 0;
    const prog15 = w15?.mfeR ?? prog5;
    const prog30 = w30?.mfeR ?? prog15;
    if (prog30 >= prog15 && prog15 >= prog5 && prog15 > 0.4) score += 18;
    else if (prog30 < prog15 * 0.6 && prog15 > 0.5) score -= 22;

    // Pullback quality
    const maxMae = Math.min(w5?.maeR ?? 0, w15?.maeR ?? 0, ev.maeR);
    if (maxMae > -0.25 && prog15 > 0.35) score += 12;
    if (maxMae < -0.55) score -= 18;

    // Volume sustainability
    if (signal.rvol >= 3) score += 10;
    else if (signal.rvol < 1.5) score -= 12;

    // Breadth / trend confirmation proxy
    if (signal.trendAlignment >= 70) score += 10;
    if (signal.trendAlignment < 45) score -= 10;

    // Volatility compression vs expansion
    if (signal.volatility != null && signal.volatility < 0.015 && prog15 > 0.5) score += 8;
    if (signal.volatility != null && signal.volatility > 0.035 && ev.stoppedOut) score -= 10;

    if (ev.hit2R) score += 15;
    else if (ev.hit1R) score += 8;
    if (ev.stoppedOut && !ev.hit1R) score -= 25;

    if (score >= 82) return 'VERY_STRONG';
    if (score >= 65) return 'STRONG';
    if (score >= 48) return 'MODERATE';
    if (score >= 30) return 'WEAKENING';
    return 'FAILING';
  }
}
