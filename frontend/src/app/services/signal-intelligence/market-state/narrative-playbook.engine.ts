import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { NarrativePlaybook } from './market-state.models';
import { deriveMarketStateSequence, pathKey, round2 } from './market-state.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

const KNOWN_PLAYBOOKS: { id: string; label: string; pattern: string[] }[] = [
  { id: 'FAILED_BREAKOUT_RECLAIM', label: 'Failed Breakout Reclaim', pattern: ['FAILED_BREAKOUT', 'VWAP_RECLAIM', 'ACCEPTANCE'] },
  { id: 'OPEN_DRIVE_EXHAUSTION', label: 'Open Drive Exhaustion', pattern: ['OPENING_DRIVE', 'EARLY_EXTENSION', 'EXHAUSTION'] },
  { id: 'SECOND_LEG_ACCEPTANCE', label: 'Second Leg Acceptance', pattern: ['ACCEPTANCE', 'SECOND_LEG_CONTINUATION'] },
  { id: 'LATE_CHASE_FAILURE', label: 'Late Chase Failure', pattern: ['LATE_CHASE_ENVIRONMENT', 'FAILED_ACCEPTANCE'] },
  { id: 'PULLBACK_CONTINUATION', label: 'Pullback Continuation', pattern: ['PULLBACK_STABILIZATION', 'ACCEPTANCE', 'SECOND_LEG_CONTINUATION'] }
];

/** Build institutional narrative playbooks from recurring state sequences. */
export class NarrativePlaybookEngine {
  discover(signals: SignalSnapshot[]): NarrativePlaybook[] {
    const evaluated = evaluatedSignals(signals);
    const pathBuckets = new Map<string, SignalSnapshot[]>();

    for (const s of evaluated) {
      const states = deriveMarketStateSequence(s);
      const key = pathKey(states.slice(0, Math.min(4, states.length)));
      pathBuckets.set(key, [...(pathBuckets.get(key) ?? []), s]);
    }

    const discovered: NarrativePlaybook[] = [...pathBuckets.entries()]
      .filter(([, bucket]) => bucket.length >= 5)
      .map(([key, bucket]) => {
        const states = key.split('→') as import('./market-state.models').MarketState[];
        const exp = computeExpectancyR(bucket);
        const cont = bucket.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
        const fake = bucket.filter(s => falseBreakout.isFalseBreakout(s));
        const known = this.matchKnown(states);

        return {
          id: known?.id ?? key,
          label: known?.label ?? states.map(s => s.replace(/_/g, ' ')).join(' → '),
          states,
          sampleCount: bucket.length,
          expectancyR: round2(exp),
          continuationRate: pct(cont.length, bucket.length),
          fakeoutRate: pct(fake.length, bucket.length),
          stability: pct(bucket.filter(s => s.evaluation!.status === 'WIN').length, bucket.length),
          verdict: exp >= 0.5 ? 'BEST' as const : exp < -0.3 ? 'DANGEROUS' as const : 'NEUTRAL' as const
        };
      });

    for (const known of KNOWN_PLAYBOOKS) {
      if (!discovered.some(d => d.id === known.id)) {
        const matches = evaluated.filter(s => {
          const st = deriveMarketStateSequence(s);
          return known.pattern.every(p => st.includes(p as import('./market-state.models').MarketState));
        });
        if (matches.length >= 3) {
          discovered.push({
            id: known.id,
            label: known.label,
            states: known.pattern as import('./market-state.models').MarketState[],
            sampleCount: matches.length,
            expectancyR: round2(computeExpectancyR(matches)),
            continuationRate: pct(matches.filter(s => (s.evaluation!.mfeR ?? 0) >= 1).length, matches.length),
            fakeoutRate: pct(matches.filter(s => falseBreakout.isFalseBreakout(s)).length, matches.length),
            stability: pct(matches.filter(s => s.evaluation!.status === 'WIN').length, matches.length),
            verdict: computeExpectancyR(matches) >= 0.5 ? 'BEST' : computeExpectancyR(matches) < -0.3 ? 'DANGEROUS' : 'NEUTRAL'
          });
        }
      }
    }

    return discovered.sort((a, b) => b.expectancyR - a.expectancyR);
  }

  private matchKnown(states: import('./market-state.models').MarketState[]): typeof KNOWN_PLAYBOOKS[0] | null {
    return KNOWN_PLAYBOOKS.find(k => k.pattern.every(p => states.includes(p as import('./market-state.models').MarketState))) ?? null;
  }
}
