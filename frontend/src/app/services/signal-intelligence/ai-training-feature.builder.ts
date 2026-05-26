import { AITrainingFeature, SignalSnapshot } from '../../models/signal-intelligence.model';
import { computeExpectancyR } from './signal-intelligence.math';

/** Builds deterministic feature rows for future model training — no inference. */
export class AITrainingFeatureBuilder {

  buildAll(signals: SignalSnapshot[]): AITrainingFeature[] {
    return signals
      .filter(s => s.evaluation?.evaluated && s.evaluation.status !== 'OPEN')
      .map(s => this.buildOne(s))
      .filter((f): f is AITrainingFeature => f != null);
  }

  buildOne(snapshot: SignalSnapshot): AITrainingFeature | null {
    const ev = snapshot.evaluation;
    if (!ev?.evaluated || ev.status === 'OPEN') return null;

    const failed = ev.status === 'LOSS';
    const outcomeR = failed ? -Math.abs(ev.maeR) : ev.mfeR;

    return {
      signalId: snapshot.id,
      signalType: snapshot.signalType,
      marketRegime: snapshot.marketRegime,
      entryPrice: snapshot.entryPrice,
      stopPrice: snapshot.stopPrice,
      rvol: snapshot.rvol,
      emaAlignment: snapshot.emaAlignment ?? false,
      vwapDistance: snapshot.vwapDistance ?? 0,
      trendAlignment: snapshot.trendAlignment,
      convictionScore: snapshot.convictionScore,
      timeframe: snapshot.timeframe,
      volatility: snapshot.volatility ?? 0,
      sessionTimeMinutes: snapshot.sessionTimeMinutes ?? 0,
      mfeR: ev.mfeR,
      maeR: ev.maeR,
      hit1R: ev.hit1R,
      hit2R: ev.hit2R,
      failed,
      expectancyOutcome: Math.round(outcomeR * 100) / 100,
      captureStage: snapshot.captureStage
    };
  }

  exportJson(signals: SignalSnapshot[]): string {
    return JSON.stringify(this.buildAll(signals), null, 2);
  }

  /** Batch expectancy for validation — not used in live trading. */
  batchExpectancy(signals: SignalSnapshot[]): number {
    return computeExpectancyR(signals);
  }
}
