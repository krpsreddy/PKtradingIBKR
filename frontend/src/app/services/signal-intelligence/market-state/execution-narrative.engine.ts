import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { MarketStatePath } from './market-state.models';
import { finalMarketState, stateLabel } from './market-state.util';

/** Convert state transitions into human-readable execution narratives. */
export class ExecutionNarrativeEngine {
  narrate(path: MarketStatePath, signal?: SignalSnapshot): string {
    const states = path.states;
    const current = path.current;

    if (states.includes('FAILED_BREAKOUT') && states.includes('VWAP_RECLAIM') && states.includes('ACCEPTANCE')) {
      return 'Opening breakout failed, reclaim stabilized, continuation accepted.';
    }
    if (states.includes('OPENING_DRIVE') && states.includes('EXHAUSTION')) {
      return 'Momentum exhausted after opening drive extension.';
    }
    if (states.includes('FAILED_ACCEPTANCE') && (signal?.trendAlignment ?? 100) < 50) {
      return 'Acceptance failed under weak breadth.';
    }
    if (states.includes('PULLBACK_STABILIZATION') && states.includes('SECOND_LEG_CONTINUATION')) {
      return 'Continuation survived pullback compression.';
    }
    if (current === 'SECOND_LEG_CONTINUATION') return 'Second leg continuation active.';
    if (current === 'VWAP_RECLAIM') return 'VWAP reclaim in progress — awaiting acceptance.';
    if (current === 'LIQUIDITY_SWEEP') return 'Liquidity sweep detected — trap risk elevated.';
    if (current === 'LATE_CHASE_ENVIRONMENT') return 'Late chase environment — extension risk rising.';
    if (current === 'TRAP_REVERSAL') return 'Trap reversal narrative — failed continuation.';
    if (path.trajectory === 'NARRATIVE_IMPROVING') return 'Narrative improving through reclaim and acceptance.';
    if (path.trajectory === 'NARRATIVE_FAILING') return 'Narrative failing — momentum not sustaining.';

    return this.compactNarrative(path);
  }

  compactNarrative(path: MarketStatePath): string {
    const states = path.states;
    if (states.length >= 2) {
      const a = stateLabel(states[states.length - 2]);
      const b = stateLabel(states[states.length - 1]);
      return `${a} → ${b}`;
    }
    return stateLabel(finalMarketState(states));
  }

  railLine(path: MarketStatePath): string {
    const current = stateLabel(path.current).toUpperCase();
    const prev = path.states.length >= 2 ? path.states[path.states.length - 2] : null;
    if (prev && ['VWAP_RECLAIM', 'ACCEPTANCE', 'SECOND_LEG_CONTINUATION'].includes(path.current)) {
      return `${stateLabel(prev).toUpperCase()} → ${current}`;
    }
    if (path.current === 'LATE_CHASE_ENVIRONMENT') return 'LATE CHASE ENVIRONMENT';
    if (path.current === 'LIQUIDITY_SWEEP') return 'LIQUIDITY SWEEP RISK';
    if (path.current === 'SECOND_LEG_CONTINUATION') return 'SECOND LEG CONTINUATION ACTIVE';
    if (path.current === 'FAILED_BREAKOUT' && path.states.includes('VWAP_RECLAIM')) {
      return 'FAILED BREAKOUT → RECLAIM ACCEPTED';
    }
    return current;
  }
}
