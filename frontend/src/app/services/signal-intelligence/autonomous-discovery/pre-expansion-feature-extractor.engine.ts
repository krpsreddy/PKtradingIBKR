import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { PreExpansionFeatureVector } from './autonomous-discovery.models';
import {
  buildQuantileBreakpoints,
  captureStageCode,
  quantileIndex,
  regimeCode,
  round2
} from './autonomous-discovery.util';

export interface FeatureExtractionContext {
  breakpoints: Record<string, number[]>;
  sessionRvolMedian: Map<string, number>;
}

/** Extract numeric pre-expansion features — no legacy signal-type labels. */
export class PreExpansionFeatureExtractorEngine {

  private readonly falseBreakout = new FalseBreakoutAnalyticsEngine();

  buildContext(signals: SignalSnapshot[]): FeatureExtractionContext {
    const rvols = signals.map(s => s.rvol ?? 0);
    const sessions = signals.map(s => s.sessionTimeMinutes ?? 0);
    const vwaps = signals.map(s => Math.abs(s.vwapDistance ?? 0));
    const trends = signals.map(s => s.trendAlignment ?? 0);
    const vols = signals.map(s => s.volatility ?? 0);
    const convs = signals.map(s => s.convictionScore ?? 0);
    const pullbacks = signals.map(s => Math.abs(s.vwapDistance ?? 0));

    const sessionRvolMedian = new Map<string, number>();
    const bySession = new Map<string, number[]>();
    for (const s of signals) {
      const k = `${s.symbol}|${new Date(s.timestamp).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })}`;
      bySession.set(k, [...(bySession.get(k) ?? []), s.rvol ?? 0]);
    }
    for (const [k, vals] of bySession) {
      const sorted = vals.slice().sort((a, b) => a - b);
      sessionRvolMedian.set(k, sorted[Math.floor(sorted.length / 2)] ?? 1);
    }

    return {
      breakpoints: {
        rvol: buildQuantileBreakpoints(rvols),
        session: buildQuantileBreakpoints(sessions),
        vwap: buildQuantileBreakpoints(vwaps),
        trend: buildQuantileBreakpoints(trends),
        volatility: buildQuantileBreakpoints(vols),
        conviction: buildQuantileBreakpoints(convs),
        pullback: buildQuantileBreakpoints(pullbacks)
      },
      sessionRvolMedian
    };
  }

  extract(s: SignalSnapshot, ctx: FeatureExtractionContext): PreExpansionFeatureVector {
    const bp = ctx.breakpoints;
    const sessionK = `${s.symbol}|${new Date(s.timestamp).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })}`;
    const sessionMed = ctx.sessionRvolMedian.get(sessionK) ?? 1;
    const rvol = s.rvol ?? 0;
    const volAccel = sessionMed > 0 ? rvol / sessionMed : rvol;

    const structureScore = this.structureScore(s);

    return {
      rvolQ: quantileIndex(rvol, bp['rvol'] ?? []),
      sessionQ: quantileIndex(s.sessionTimeMinutes ?? 0, bp['session'] ?? []),
      vwapDistQ: quantileIndex(Math.abs(s.vwapDistance ?? 0), bp['vwap'] ?? []),
      trendQ: quantileIndex(s.trendAlignment ?? 0, bp['trend'] ?? []),
      volatilityQ: quantileIndex(s.volatility ?? 0, bp['volatility'] ?? []),
      convictionQ: quantileIndex(s.convictionScore ?? 0, bp['conviction'] ?? []),
      extended: s.extendedEntry ? 1 : 0,
      captureStage: captureStageCode(s),
      regimeCode: regimeCode(s.marketRegime),
      emaAligned: s.emaAlignment ? 1 : 0,
      pullbackDepthQ: quantileIndex(Math.abs(s.vwapDistance ?? 0), bp['pullback'] ?? []),
      volumeAccelQ: quantileIndex(volAccel, [1.2, 1.5, 2, 3]),
      structureScore
    };
  }

  /** Numeric structure score from observable fields only. */
  private structureScore(s: SignalSnapshot): number {
    let score = 40;
    if ((s.trendAlignment ?? 0) >= 55) score += 12;
    if ((s.rvol ?? 0) >= 2) score += 10;
    if ((s.vwapDistance ?? 0) >= -0.003) score += 8;
    if (s.emaAlignment) score += 10;
    if ((s.convictionScore ?? 0) >= 60) score += 8;
    if (!this.falseBreakout.isFalseBreakout(s)) score += 8;
    if (s.extendedEntry) score -= 15;
    if ((s.volatility ?? 0) > 0.04) score -= 5;
    return Math.max(0, Math.min(100, score));
  }

  centroid(vectors: PreExpansionFeatureVector[]): PreExpansionFeatureVector {
    if (!vectors.length) {
      return {
        rvolQ: 0, sessionQ: 0, vwapDistQ: 0, trendQ: 0, volatilityQ: 0, convictionQ: 0,
        extended: 0, captureStage: 0, regimeCode: 0, emaAligned: 0, pullbackDepthQ: 0,
        volumeAccelQ: 0, structureScore: 0
      };
    }
    const mean = (fn: (v: PreExpansionFeatureVector) => number) =>
      round2(vectors.reduce((n, v) => n + fn(v), 0) / vectors.length);

    return {
      rvolQ: Math.round(mean(v => v.rvolQ)),
      sessionQ: Math.round(mean(v => v.sessionQ)),
      vwapDistQ: Math.round(mean(v => v.vwapDistQ)),
      trendQ: Math.round(mean(v => v.trendQ)),
      volatilityQ: Math.round(mean(v => v.volatilityQ)),
      convictionQ: Math.round(mean(v => v.convictionQ)),
      extended: mean(v => v.extended) >= 0.5 ? 1 : 0,
      captureStage: Math.round(mean(v => v.captureStage)) as 0 | 1 | 2,
      regimeCode: Math.round(mean(v => v.regimeCode)),
      emaAligned: mean(v => v.emaAligned) >= 0.5 ? 1 : 0,
      pullbackDepthQ: Math.round(mean(v => v.pullbackDepthQ)),
      volumeAccelQ: Math.round(mean(v => v.volumeAccelQ)),
      structureScore: Math.round(mean(v => v.structureScore))
    };
  }
}
