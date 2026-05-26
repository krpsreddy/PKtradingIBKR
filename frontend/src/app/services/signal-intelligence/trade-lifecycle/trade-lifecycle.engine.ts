import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import {
  AcceptanceOutcome,
  TradeLifecycleEvent,
  TradeLifecyclePath,
  TradeLifecycleState
} from './trade-lifecycle.models';
import { realizedR, resolveEntryTiming, windowAt } from './trade-lifecycle.util';
import { ContinuationHealthEngine } from './continuation-health.engine';

/** Infer lifecycle path from evaluation windows + outcome — deterministic, no live order mgmt. */
export class TradeLifecycleEngine {
  private readonly continuationHealth = new ContinuationHealthEngine();

  buildPath(signal: SignalSnapshot): TradeLifecyclePath {
    const ev = signal.evaluation;
    const events: TradeLifecycleEvent[] = [];
    const ts = signal.timestamp;

    events.push({
      state: 'INITIATION',
      timestamp: ts,
      label: `${signal.signalType} ${signal.captureStage}`,
      metrics: { conviction: signal.convictionScore, rvol: signal.rvol }
    });

    const w5 = windowAt(ev, 5);
    const w15 = windowAt(ev, 15);
    const w30 = windowAt(ev, 30);

    const acceptance = this.detectAcceptance(signal, w5, w15);
    if (acceptance !== 'UNKNOWN') {
      events.push({
        state: 'ACCEPTANCE',
        timestamp: ts + 5 * 60_000,
        label: acceptance === 'ACCEPTED' ? 'Setup accepted' : 'Setup rejected',
        metrics: {
          mfeR5: w5?.mfeR ?? 0,
          maeR5: w5?.maeR ?? 0,
          holdAboveTrigger: acceptance === 'ACCEPTED'
        }
      });
    }

    if (ev?.hit1R || (ev?.mfeR ?? 0) >= 1) {
      events.push({
        state: 'EXPANSION',
        timestamp: ts + 15 * 60_000,
        label: 'Reached +1R expansion',
        metrics: { mfeR: ev?.mfeR ?? 0, hit1R: ev?.hit1R ?? false }
      });
    }

    if (ev?.hit2R || (ev?.mfeR ?? 0) >= 1.8) {
      events.push({
        state: 'EXTENSION',
        timestamp: ts + 30 * 60_000,
        label: 'Second-leg extension',
        metrics: { mfeR: ev?.mfeR ?? 0, hit2R: ev?.hit2R ?? false }
      });
    }

    const exhausted = this.detectExhaustion(signal, w15, w30);
    if (exhausted) {
      events.push({
        state: 'EXHAUSTION',
        timestamp: ts + 45 * 60_000,
        label: 'Momentum exhaustion / give-back',
        metrics: { mfeR: ev?.mfeR ?? 0, gaveBack: true }
      });
    }

    if (ev?.status === 'LOSS' || ev?.stoppedOut) {
      events.push({
        state: 'FAILURE',
        timestamp: ts + (ev?.durationMinutes ?? 30) * 60_000,
        label: ev?.exitReason === 'STOP' ? 'Stop hit' : 'Trade failed',
        metrics: { maeR: ev?.maeR ?? 0 }
      });
    }

    if (ev?.evaluated) {
      events.push({
        state: 'EXIT',
        timestamp: ts + (ev.durationMinutes ?? 60) * 60_000,
        label: `Exit · ${ev.status}`,
        metrics: { realizedR: realizedR(signal), exitReason: ev.exitReason ?? 'TIMEOUT' }
      });
    }

    const terminal = events[events.length - 1]?.state ?? 'INITIATION';
    return {
      signalId: signal.id,
      symbol: signal.symbol,
      signalType: signal.signalType,
      timestamp: ts,
      events,
      terminalState: terminal,
      acceptance,
      continuationHealth: this.continuationHealth.evaluate(signal),
      entryTiming: resolveEntryTiming(signal),
      realizedR: realizedR(signal),
      mfeR: ev?.mfeR ?? 0,
      maeR: ev?.maeR ?? 0
    };
  }

  inferCurrentState(signal: SignalSnapshot): TradeLifecycleState {
    const path = this.buildPath(signal);
    return path.terminalState;
  }

  private detectAcceptance(
    signal: SignalSnapshot,
    w5?: { mfeR: number; maeR: number; stoppedOut?: boolean },
    w15?: { mfeR: number; maeR: number; stoppedOut?: boolean }
  ): AcceptanceOutcome {
    if (!signal.evaluation?.evaluated) return 'UNKNOWN';

    const rejected =
      (w5?.stoppedOut && (w5.mfeR ?? 0) < 0.25)
      || (signal.evaluation.stoppedOut && (signal.evaluation.mfeR ?? 0) < 0.35)
      || (signal.signalType === 'BREAKOUT' && (w15?.maeR ?? 0) < -0.45);

    const accepted =
      (w5?.mfeR ?? 0) >= 0.25 && (w5?.maeR ?? 0) > -0.35
      || (w15?.mfeR ?? 0) >= 0.45
      || signal.evaluation.hit1R;

    const vwapAccepted = (signal.vwapDistance ?? 0) >= -0.005 || signal.signalType === 'VWAP_RECLAIM';
    const continuationSustained = signal.signalType === 'TREND_CONTINUATION' && (w15?.mfeR ?? 0) > 0.3;

    if (rejected && !accepted) return 'REJECTED';
    if ((accepted && vwapAccepted) || continuationSustained) return 'ACCEPTED';
    if (accepted || rejected) return 'MIXED';
    return 'UNKNOWN';
  }

  private detectExhaustion(
    signal: SignalSnapshot,
    w15?: { mfeR: number; maeR: number },
    w30?: { mfeR: number; maeR: number }
  ): boolean {
    const ev = signal.evaluation;
    if (!ev) return false;
    const peak = ev.mfeR;
    const late = w30?.mfeR ?? peak;
    const decay = peak - late;
    return peak >= 0.8 && decay >= 0.45 && !ev.hit2R;
  }
}
