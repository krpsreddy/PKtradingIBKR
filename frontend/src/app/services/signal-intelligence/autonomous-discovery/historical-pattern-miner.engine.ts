import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { PreExpansionFeatureVector } from './autonomous-discovery.models';
import { PreExpansionFeatureExtractorEngine } from './pre-expansion-feature-extractor.engine';
import {
  confidenceTier,
  featureKey,
  isEliteWinner,
  mfeDollars,
  mfeR,
  round2
} from './autonomous-discovery.util';

export interface MinedPatternBucket {
  key: string;
  centroid: PreExpansionFeatureVector;
  signals: SignalSnapshot[];
  winRate: number;
  avgR: number;
  avgDollar: number;
  fakeoutPct: number;
  continuationPct: number;
}

/** Mine recurring pre-expansion condition combinations from evaluated history. */
export class HistoricalPatternMinerEngine {
  private readonly extractor = new PreExpansionFeatureExtractorEngine();
  private readonly falseBreakout = new FalseBreakoutAnalyticsEngine();

  mine(signals: SignalSnapshot[], minSample = 3): MinedPatternBucket[] {
    const evaluated = evaluatedSignals(signals);
    const ctx = this.extractor.buildContext(evaluated);
    const map = new Map<string, { vectors: PreExpansionFeatureVector[]; signals: SignalSnapshot[] }>();

    for (const s of evaluated) {
      const v = this.extractor.extract(s, ctx);
      const key = featureKey(v);
      const bucket = map.get(key) ?? { vectors: [], signals: [] };
      bucket.vectors.push(v);
      bucket.signals.push(s);
      map.set(key, bucket);
    }

    const out: MinedPatternBucket[] = [];
    for (const [key, bucket] of map) {
      if (bucket.signals.length < minSample) continue;
      const wins = bucket.signals.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5);
      const cont = bucket.signals.filter(s => mfeR(s) >= 1);
      const fake = bucket.signals.filter(s => this.falseBreakout.isFalseBreakout(s));
      out.push({
        key,
        centroid: this.extractor.centroid(bucket.vectors),
        signals: bucket.signals,
        winRate: pct(wins.length, bucket.signals.length),
        avgR: round2(bucket.signals.reduce((n, s) => n + mfeR(s), 0) / bucket.signals.length),
        avgDollar: round2(bucket.signals.reduce((n, s) => n + mfeDollars(s), 0) / bucket.signals.length),
        fakeoutPct: pct(fake.length, bucket.signals.length),
        continuationPct: pct(cont.length, bucket.signals.length)
      });
    }

    return out.sort((a, b) => b.avgR - a.avgR);
  }

  eliteBuckets(signals: SignalSnapshot[]): MinedPatternBucket[] {
    const elite = evaluatedSignals(signals).filter(isEliteWinner);
    return this.mine(elite, 2);
  }
}
