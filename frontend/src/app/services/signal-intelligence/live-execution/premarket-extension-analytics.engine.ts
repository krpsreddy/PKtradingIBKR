import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { LiveExecutionContext, PremarketExtensionBucket, PremarketExtensionSnapshot } from './live-execution.models';
import { extensionPctFromContext, premarketExtensionBucket } from './live-execution-context.util';

const BUCKETS: PremarketExtensionBucket[] = ['0–2%', '2–5%', '5–8%', '8%+'];

/** Tracks continuation/reclaim/fakeout by premarket extension bucket. */
export class PremarketExtensionAnalyticsEngine {
  private readonly falseBreakout = new FalseBreakoutAnalyticsEngine();

  classifyLive(ctx: LiveExecutionContext): PremarketExtensionSnapshot {
    const ext = extensionPctFromContext(ctx);
    const bucket = premarketExtensionBucket(ext);
    return {
      bucket,
      extensionPct: ext,
      continuationExpectancy: 0,
      reclaimExpectancy: 0,
      fakeoutProbability: bucketFakeoutPrior(bucket),
      openFailureRate: bucketFailurePrior(bucket),
      trapFrequency: bucketTrapPrior(bucket),
      label: `${bucket} premarket extension`
    };
  }

  analyze(signals: SignalSnapshot[]): Map<PremarketExtensionBucket, PremarketExtensionSnapshot> {
    const map = new Map<PremarketExtensionBucket, PremarketExtensionSnapshot>();

    for (const bucket of BUCKETS) {
      const subset = signals.filter(s => bucketForSignal(s) === bucket);
      const evaluated = evaluatedSignals(subset);
      const cont = subset.filter(s => s.signalType === 'TREND_CONTINUATION' || s.signalType === 'MOMENTUM');
      const reclaim = subset.filter(s => s.signalType === 'VWAP_RECLAIM');
      const falseSnap = this.falseBreakout.analyze(subset);
      const losses = evaluated.filter(s => s.evaluation!.status === 'LOSS');
      const opening = subset.filter(s => (s.sessionTimeMinutes ?? 999) < 15);
      const openingLoss = evaluatedSignals(opening).filter(s => s.evaluation!.status === 'LOSS');

      map.set(bucket, {
        bucket,
        extensionPct: avgExt(subset),
        continuationExpectancy: computeExpectancyR(cont),
        reclaimExpectancy: computeExpectancyR(reclaim),
        fakeoutProbability: falseSnap.falseBreakoutRate,
        openFailureRate: pct(openingLoss.length, Math.max(1, evaluatedSignals(opening).length)),
        trapFrequency: pct(losses.filter(s => (s.sessionTimeMinutes ?? 999) < 15).length, Math.max(1, evaluated.length)),
        label: `${bucket} extension`
      });
    }
    return map;
  }

  enrichLive(ctx: LiveExecutionContext, historical: Map<PremarketExtensionBucket, PremarketExtensionSnapshot>): PremarketExtensionSnapshot {
    const live = this.classifyLive(ctx);
    const hist = historical.get(live.bucket);
    if (!hist) return live;
    return {
      ...live,
      continuationExpectancy: hist.continuationExpectancy,
      reclaimExpectancy: hist.reclaimExpectancy,
      fakeoutProbability: hist.fakeoutProbability,
      openFailureRate: hist.openFailureRate,
      trapFrequency: hist.trapFrequency
    };
  }
}

function bucketForSignal(s: SignalSnapshot): PremarketExtensionBucket {
  const pct = Math.abs(s.vwapDistance ?? 0) * 100;
  return premarketExtensionBucket(pct);
}

function avgExt(signals: SignalSnapshot[]): number {
  if (!signals.length) return 0;
  return signals.reduce((a, s) => a + Math.abs(s.vwapDistance ?? 0) * 100, 0) / signals.length;
}

function bucketFakeoutPrior(bucket: PremarketExtensionBucket): number {
  switch (bucket) {
    case '0–2%': return 22;
    case '2–5%': return 28;
    case '5–8%': return 38;
    case '8%+': return 48;
  }
}

function bucketFailurePrior(bucket: PremarketExtensionBucket): number {
  switch (bucket) {
    case '0–2%': return 18;
    case '2–5%': return 24;
    case '5–8%': return 32;
    case '8%+': return 42;
  }
}

function bucketTrapPrior(bucket: PremarketExtensionBucket): number {
  switch (bucket) {
    case '0–2%': return 15;
    case '2–5%': return 20;
    case '5–8%': return 30;
    case '8%+': return 40;
  }
}
