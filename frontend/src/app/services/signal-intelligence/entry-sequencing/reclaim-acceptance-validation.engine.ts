import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { ReclaimAcceptanceReport } from './entry-sequencing.models';
import { breadthLabel, extensionPct, rvolBucket, windows, w } from './entry-sequencing.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Deep reclaim acceptance validation. */
export class ReclaimAcceptanceValidationEngine {

  analyze(signals: SignalSnapshot[]): ReclaimAcceptanceReport {
    const reclaims = evaluatedSignals(signals).filter(s =>
      s.signalType === 'VWAP_RECLAIM' || s.signalType === 'BREAKOUT' || s.signalType === 'MOMENTUM'
    );

    if (!reclaims.length) return emptyReport();

    const held = reclaims.filter(s => this.reclaimHeld(s));
    const rejected = reclaims.filter(s => (s.evaluation?.maeR ?? 0) < -0.5 && !(s.evaluation?.hit1R));
    const continued = reclaims.filter(s => w(windows(s).w15).mfe >= 0.5);
    const recovered = reclaims.filter(s => (s.evaluation?.maeR ?? 0) < -0.4 && (s.evaluation?.mfeR ?? 0) >= 0.5);
    const secondLeg = reclaims.filter(s => s.evaluation?.hit2R || w(windows(s).w15).mfe >= 1);
    const falseOnes = reclaims.filter(s => falseBreakout.isFalseBreakout(s));
    const exhausted = reclaims.filter(s => w(windows(s).w15).mfe < w(windows(s).w5).mfe && w(windows(s).w5).mfe > 0.3);

    const setupMap = new Map<string, SignalSnapshot[]>();
    const breadthMap = new Map<string, SignalSnapshot[]>();
    const rvolMap = new Map<string, SignalSnapshot[]>();

    for (const s of reclaims) {
      const sk = `${s.signalType}·${s.marketRegime}`;
      setupMap.set(sk, [...(setupMap.get(sk) ?? []), s]);
      breadthMap.set(breadthLabel(s), [...(breadthMap.get(breadthLabel(s)) ?? []), s]);
      rvolMap.set(rvolBucket(s.rvol ?? 0), [...(rvolMap.get(rvolBucket(s.rvol ?? 0)) ?? []), s]);
    }

    return {
      sampleCount: reclaims.length,
      holdRate: pct(held.length, reclaims.length),
      rejectionRate: pct(rejected.length, reclaims.length),
      continuationRate: pct(continued.length, reclaims.length),
      recoveryRate: pct(recovered.length, reclaims.length),
      secondLegRate: pct(secondLeg.length, reclaims.length),
      fakeoutRate: pct(falseOnes.length, reclaims.length),
      exhaustionProbability: pct(exhausted.length, reclaims.length),
      bySetupRegime: mapKeyRows(setupMap),
      byBreadth: mapBucketRows(breadthMap),
      byRvol: mapBucketRows(rvolMap),
      failureSignatures: this.failureSignatures(reclaims),
      advisoryOnly: true
    };
  }

  reclaimHeld(s: SignalSnapshot): boolean {
    const m5 = w(windows(s).w5);
    return m5.mfe >= 0.15 && m5.mae > -0.4;
  }

  private failureSignatures(reclaims: SignalSnapshot[]): string[] {
    const out: string[] = [];
    const weak = reclaims.filter(s => (s.trendAlignment ?? 0) < 50);
    if (weak.length >= 3 && computeExpectancyR(weak) < 0) out.push('Weak breadth reclaims fail before continuation');
    const ext = reclaims.filter(s => extensionPct(s) >= 8);
    if (ext.length >= 2 && pct(ext.filter(s => falseBreakout.isFalseBreakout(s)).length, ext.length) >= 40) {
      out.push('Extended reclaims (>8%) reject frequently');
    }
    return out.slice(0, 5);
  }
}

function mapKeyRows(map: Map<string, SignalSnapshot[]>) {
  return [...map.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .map(([key, rows]) => ({
      key,
      sampleCount: rows.length,
      holdRate: pct(rows.filter(s => w(windows(s).w5).mfe >= 0.15).length, rows.length),
      expectancyR: computeExpectancyR(rows)
    }))
    .sort((a, b) => b.expectancyR - a.expectancyR);
}

function mapBucketRows(map: Map<string, SignalSnapshot[]>) {
  return [...map.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .map(([bucket, rows]) => ({
      bucket,
      sampleCount: rows.length,
      holdRate: pct(rows.filter(s => w(windows(s).w5).mfe >= 0.15).length, rows.length),
      expectancyR: computeExpectancyR(rows)
    }))
    .sort((a, b) => b.expectancyR - a.expectancyR);
}

function emptyReport(): ReclaimAcceptanceReport {
  return {
    sampleCount: 0, holdRate: 0, rejectionRate: 0, continuationRate: 0, recoveryRate: 0,
    secondLegRate: 0, fakeoutRate: 0, exhaustionProbability: 0,
    bySetupRegime: [], byBreadth: [], byRvol: [], failureSignatures: [], advisoryOnly: true
  };
}
