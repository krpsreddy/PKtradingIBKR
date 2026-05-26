import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { MarketStatePath, MarketStateTransition } from './market-state.models';
import {
  deriveMarketStateSequence,
  finalMarketState,
  inferTrajectory,
  stateLabel
} from './market-state.util';

/** Deterministic market state machine — tracks transitions and trajectory. */
export class MarketStateMachineEngine {
  path(signal: SignalSnapshot): MarketStatePath {
    const states = deriveMarketStateSequence(signal);
    const transitions = this.buildTransitions(states, signal.timestamp);
    const current = finalMarketState(states);
    const trajectory = inferTrajectory(states);

    return { states, transitions, current, trajectory };
  }

  private buildTransitions(states: ReturnType<typeof deriveMarketStateSequence>, ts: number): MarketStateTransition[] {
    const out: MarketStateTransition[] = [];
    for (let i = 0; i < states.length; i++) {
      out.push({
        from: i > 0 ? states[i - 1] : null,
        to: states[i],
        timestamp: ts + i * 5 * 60_000,
        quality: this.transitionQuality(states, i)
      });
    }
    return out;
  }

  private transitionQuality(states: ReturnType<typeof deriveMarketStateSequence>, idx: number): MarketStateTransition['quality'] {
    const to = states[idx];
    const from = idx > 0 ? states[idx - 1] : null;
    const good = ['ACCEPTANCE', 'SECOND_LEG_CONTINUATION', 'VWAP_RECLAIM', 'PULLBACK_STABILIZATION', 'TREND_EXPANSION'];
    const bad = ['FAILED_BREAKOUT', 'FAILED_ACCEPTANCE', 'TRAP_REVERSAL', 'LIQUIDITY_SWEEP'];

    if (good.includes(to) && from && bad.includes(from)) return 'STRONG';
    if (bad.includes(to)) return 'WEAK';
    if (good.includes(to)) return 'STRONG';
    return 'MODERATE';
  }

  transitionSummary(path: MarketStatePath): string {
    if (path.states.length < 2) return stateLabel(path.current);
    const last = path.transitions[path.transitions.length - 1];
    if (last?.from) return `${stateLabel(last.from)} → ${stateLabel(last.to)}`;
    return stateLabel(path.current);
  }
}
