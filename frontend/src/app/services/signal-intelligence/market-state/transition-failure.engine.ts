import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals } from '../signal-intelligence.math';
import { TransitionFailureInsight } from './market-state.models';
import { deriveMarketStateSequence, finalMarketState } from './market-state.util';
import { MarketStateMachineEngine } from './market-state-machine.engine';

/** Find where market narratives break down. */
export class TransitionFailureEngine {
  private readonly machine = new MarketStateMachineEngine();

  analyze(signals: SignalSnapshot[]): TransitionFailureInsight[] {
    const evaluated = evaluatedSignals(signals);
    const counters = new Map<string, { count: number; breakPoint: import('./market-state.models').MarketState }>();

    for (const s of evaluated) {
      const path = this.machine.path(s);
      const failures = this.detectFailures(s, path.states);
      for (const f of failures) {
        const key = f.label;
        counters.set(key, { count: (counters.get(key)?.count ?? 0) + 1, breakPoint: f.breakPoint });
      }
    }

    return [...counters.entries()]
      .map(([label, v]) => ({
        id: label.toLowerCase().replace(/\s+/g, '-'),
        label,
        sampleCount: v.count,
        breakPoint: v.breakPoint,
        note: `Narrative broke at ${v.breakPoint.replace(/_/g, ' ')} — n=${v.count}`
      }))
      .sort((a, b) => b.sampleCount - a.sampleCount)
      .slice(0, 10);
  }

  private detectFailures(s: SignalSnapshot, states: ReturnType<typeof deriveMarketStateSequence>): { label: string; breakPoint: import('./market-state.models').MarketState }[] {
    const out: { label: string; breakPoint: import('./market-state.models').MarketState }[] = [];
    const ev = s.evaluation;
    const current = finalMarketState(states);

    if (states.includes('VWAP_RECLAIM') && current === 'FAILED_ACCEPTANCE') {
      out.push({ label: 'Reclaim rejected', breakPoint: 'FAILED_ACCEPTANCE' });
    }
    if (states.includes('ACCEPTANCE') && current === 'EXHAUSTION' && ev?.status === 'LOSS') {
      out.push({ label: 'Continuation exhausted', breakPoint: 'EXHAUSTION' });
    }
    if ((s.trendAlignment ?? 100) < 50 && states.includes('ACCEPTANCE') && ev?.status === 'LOSS') {
      out.push({ label: 'Breadth divergence', breakPoint: 'FAILED_ACCEPTANCE' });
    }
    if (states.includes('SECOND_LEG_CONTINUATION') === false && states.includes('ACCEPTANCE') && ev?.status === 'LOSS') {
      out.push({ label: 'Failed second leg', breakPoint: 'FAILED_ACCEPTANCE' });
    }
    if (states.includes('OPENING_DRIVE') && current === 'TRAP_REVERSAL') {
      out.push({ label: 'Trend instability', breakPoint: 'TRAP_REVERSAL' });
    }

    return out;
  }
}
