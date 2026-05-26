import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { computeExpectancyR } from '../signal-intelligence.math';
import { AcceptanceConfirmationResult } from './suppression-validation.models';
import { ACCEPTANCE_KEEP_RULES } from './suppression-rules.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Test acceptance confirmation vs instant breakout entries. */
export class AcceptanceConfirmationEngine {

  analyze(signals: SignalSnapshot[]): AcceptanceConfirmationResult[] {
    const evaluated = evaluatedSignals(signals);
    const instantBreakouts = evaluated.filter(s =>
      s.signalType === 'BREAKOUT' || s.signalType === 'MOMENTUM'
    );
    const instantExp = instantBreakouts.length ? computeExpectancyR(instantBreakouts) : 0;
    const instantFake = instantBreakouts.length
      ? pct(instantBreakouts.filter(s => falseBreakout.isFalseBreakout(s)).length, instantBreakouts.length)
      : 0;

    return ACCEPTANCE_KEEP_RULES.map(rule => {
      const confirmed = evaluated.filter(s => rule.matches(s));
      const confirmedExp = confirmed.length ? computeExpectancyR(confirmed) : 0;
      const confirmedFake = confirmed.length
        ? pct(confirmed.filter(s => falseBreakout.isFalseBreakout(s)).length, confirmed.length)
        : 0;

      return {
        id: rule.id,
        label: rule.label,
        instantExpectancyR: round2(instantExp),
        confirmedExpectancyR: round2(confirmedExp),
        deltaR: round2(confirmedExp - instantExp),
        fakeoutImprovement: round2(instantFake - confirmedFake),
        sampleInstant: instantBreakouts.length,
        sampleConfirmed: confirmed.length
      };
    }).filter(r => r.sampleConfirmed >= 3);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
