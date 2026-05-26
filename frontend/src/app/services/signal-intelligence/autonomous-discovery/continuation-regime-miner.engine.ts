import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import {
  HiddenContinuationPattern,
  InstitutionalExpansionProfile,
  PreExpansionConditionReport
} from './autonomous-discovery.models';
import { PreExpansionFeatureExtractorEngine } from './pre-expansion-feature-extractor.engine';
import { StrategyCluster } from './unsupervised-strategy-clustering.engine';
import { WinnerSequenceAnalysisEngine } from './winner-sequence-analysis.engine';
import {
  confidenceTier,
  describeFeatureVector,
  isBigDollarWinner,
  isEliteWinner,
  mfeDollars,
  mfeR,
  round2,
  strategyNameFor
} from './autonomous-discovery.util';

/** Mine continuation persistence regimes from discovered clusters. */
export class ContinuationRegimeMinerEngine {
  private readonly extractor = new PreExpansionFeatureExtractorEngine();
  private readonly winnerSeq = new WinnerSequenceAnalysisEngine();

  hiddenPatterns(clusters: StrategyCluster[], breakpoints: Record<string, number[]>): HiddenContinuationPattern[] {
    return clusters
      .filter(c => c.continuationPct >= 50 && c.avgR >= 1)
      .map(c => ({
        patternId: c.clusterId,
        name: c.name,
        preConditions: describeFeatureVector(c.centroid, breakpoints),
        sampleCount: c.sampleCount,
        winRate: c.winRate,
        avgR: c.avgR,
        continuationPct: c.continuationPct,
        confidence: c.confidence
      }))
      .sort((a, b) => b.continuationPct - a.continuationPct)
      .slice(0, 12);
  }

  institutionalProfiles(signals: SignalSnapshot[]): InstitutionalExpansionProfile[] {
    const evaluated = evaluatedSignals(signals);
    const ctx = this.extractor.buildContext(evaluated);
    const elite = evaluated.filter(s => isEliteWinner(s) || isBigDollarWinner(s));
    const map = new Map<string, SignalSnapshot[]>();

    for (const s of elite) {
      const v = this.extractor.extract(s, ctx);
      const key = `${v.rvolQ}:${v.sessionQ}:${v.trendQ}:${v.volumeAccelQ}`;
      map.set(key, [...(map.get(key) ?? []), s]);
    }

    return [...map.entries()]
      .map(([key, rows]) => {
        const vectors = rows.map(s => this.extractor.extract(s, ctx));
        const centroid = this.extractor.centroid(vectors);
        const wins = rows.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5);
        const cont = rows.filter(s => mfeR(s) >= 1);
        const name = strategyNameFor('EXPANSION_CLUSTER', key);
        const seqNotes = this.winnerSeq.aggregatePreConditions(
          this.winnerSeq.analyze(rows)
        ).slice(0, 4).map(n => n.note);

        return {
          profileId: `IEP_${key}`,
          label: name,
          sampleCount: rows.length,
          winRate: pct(wins.length, rows.length),
          avgR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
          avgDollar: round2(rows.reduce((n, s) => n + mfeDollars(s), 0) / rows.length),
          continuationPct: pct(cont.length, rows.length),
          preExpansionSummary: seqNotes.length ? seqNotes : describeFeatureVector(centroid, ctx.breakpoints).map(c => c.value),
          confidence: confidenceTier(rows.length)
        };
      })
      .filter(p => p.sampleCount >= 2)
      .sort((a, b) => b.avgR - a.avgR)
      .slice(0, 10);
  }

  preExpansionConditions(signals: SignalSnapshot[]): PreExpansionConditionReport[] {
    const insights = this.winnerSeq.aggregatePreConditions(this.winnerSeq.analyze(signals));
    const evaluated = evaluatedSignals(signals);
    const baselineR = evaluated.length
      ? evaluated.reduce((n, s) => n + mfeR(s), 0) / evaluated.length
      : 0;

    return insights.map(i => ({
      condition: i.note,
      presencePct: i.presencePct,
      avgRWhenPresent: i.avgR,
      avgRWhenAbsent: round2(baselineR),
      liftR: round2(i.avgR - baselineR),
      sampleCount: i.count,
      confidence: confidenceTier(i.count)
    }));
  }
}
