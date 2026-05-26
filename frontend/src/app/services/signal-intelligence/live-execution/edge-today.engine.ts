import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import {
  AUTONOMOUS_OPPORTUNITY_TYPES,
  formatAutonomousOpportunityType,
  resolveAutonomousOpportunityType
} from '../../../utils/autonomous-terminology.util';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { EdgeTodayInsight, EdgeTodaySnapshot } from './live-execution.models';

/** Detects which autonomous opportunity types are working TODAY from resolved signals. */
export class EdgeTodayEngine {

  analyze(todaySignals: SignalSnapshot[]): EdgeTodaySnapshot {
    const evaluated = evaluatedSignals(todaySignals);
    const insights: EdgeTodayInsight[] = [];

    for (const setup of AUTONOMOUS_OPPORTUNITY_TYPES) {
      const subset = todaySignals.filter(s => resolveAutonomousOpportunityType(s) === setup);
      const ev = evaluatedSignals(subset);
      if (ev.length < 1) continue;

      const exp = computeExpectancyR(subset);
      const wins = ev.filter(s => s.evaluation!.status === 'WIN');
      const wr = pct(wins.length, ev.length);

      let tone: EdgeTodayInsight['tone'] = 'WEAK';
      if (exp > 0.15 && wr >= 55) tone = 'WORKING';
      else if (exp > 0.08) tone = 'STRONG';
      else if (exp < -0.05) tone = 'FAILING';

      const label = formatAutonomousOpportunityType(setup);
      insights.push({
        setup,
        tone,
        message: `${label} ${tone.toLowerCase()} today (${exp >= 0 ? '+' : ''}${exp.toFixed(2)}R, n=${ev.length})`,
        expectancyR: exp,
        sampleCount: ev.length
      });
    }

    const reclaim = insights.find(i => i.setup === 'VWAP_PERSISTENCE');
    const momentum = insights.find(i => i.setup === 'EARLY_CONTINUATION');
    const breakout = insights.find(i => i.setup === 'INSTITUTIONAL_ACCELERATION');

    const after10 = todaySignals.filter(s => (s.sessionTimeMinutes ?? 0) >= 90);
    const after10Ev = evaluatedSignals(after10);
    const contAfter10 = after10Ev.filter(s => {
      const opp = resolveAutonomousOpportunityType(s);
      return (opp === 'TREND_RESUMPTION' || opp === 'EARLY_CONTINUATION') && s.evaluation!.status === 'WIN';
    });

    const opening = todaySignals.filter(s => (s.sessionTimeMinutes ?? 999) < 15);
    const openingFalse = evaluatedSignals(opening).filter(s =>
      s.evaluation!.status === 'LOSS' && !s.evaluation!.hit1R
    );

    const reclaimsWorking = reclaim?.tone === 'WORKING' || reclaim?.tone === 'STRONG';
    const momentumFailing = momentum?.tone === 'FAILING';
    const breakoutsWeak = breakout?.tone === 'FAILING' || breakout?.tone === 'WEAK';
    const continuationStrongAfter10 = after10Ev.length >= 2 && pct(contAfter10.length, after10Ev.length) >= 50;
    const openingFakeoutsElevated = opening.length >= 2 && pct(openingFalse.length, evaluatedSignals(opening).length) >= 45;

    const headlineParts: string[] = [];
    if (reclaimsWorking) headlineParts.push('VWAP PERSISTENCE WORKING TODAY');
    if (momentumFailing) headlineParts.push('EARLY CONTINUATION FAILING');
    if (breakoutsWeak) headlineParts.push('INSTITUTIONAL ACCELERATION WEAK');
    if (continuationStrongAfter10) headlineParts.push('CONTINUATION STRONG AFTER 10AM');
    if (openingFakeoutsElevated) headlineParts.push('OPENING FAKEOUTS ELEVATED');

    return {
      insights,
      headline: headlineParts.length ? headlineParts.join(' · ') : 'Insufficient today samples for edge read',
      reclaimsWorking,
      momentumFailing,
      breakoutsWeak,
      continuationStrongAfter10,
      openingFakeoutsElevated
    };
  }
}

export function startOfSessionTs(): number {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14, 30, 0));
  if (now.getTime() < d.getTime()) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.getTime();
}
