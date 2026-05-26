import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { SecondLegReport } from './entry-sequencing.models';
import { windows, w } from './entry-sequencing.util';

/** Analyze second-leg continuation quality. */
export class SecondLegConfirmationEngine {

  analyze(signals: SignalSnapshot[]): SecondLegReport {
    const evaluated = evaluatedSignals(signals);
    const withFirstLeg = evaluated.filter(s => w(windows(s).w5).mfe >= 0.35);
    const secondLeg = withFirstLeg.filter(s => s.evaluation?.hit2R || w(windows(s).w15).mfe >= 1);
    const exhausted = withFirstLeg.filter(s =>
      w(windows(s).w15).mfe < w(windows(s).w5).mfe && w(windows(s).w5).mfe >= 0.4
    );

    return {
      sampleCount: withFirstLeg.length,
      successRate: pct(secondLeg.length, Math.max(1, withFirstLeg.length)),
      expectancyR: withFirstLeg.length ? computeExpectancyR(withFirstLeg) : 0,
      exhaustionAfterFirstLeg: pct(exhausted.length, Math.max(1, withFirstLeg.length)),
      bestConditions: [
        'Reclaim hold + shallow pullback',
        'Strong breadth + controlled extension',
        'Second push within 15m window with MFE ≥1R'
      ],
      failedPatterns: [
        'First leg vertical, second leg fails to expand',
        'Breadth divergence after initial push',
        'RVOL spike without hold confirmation'
      ],
      advisoryOnly: true
    };
  }

  hasSecondLeg(s: SignalSnapshot): boolean {
    return !!s.evaluation?.hit2R || w(windows(s).w15).mfe >= 1;
  }
}
