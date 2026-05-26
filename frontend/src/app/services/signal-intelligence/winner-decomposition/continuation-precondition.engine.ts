import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import {
  ContinuationAcceptanceProfile,
  EliteEntryCondition,
  ExpansionConditionMatrixRow
} from './winner-decomposition.models';
import {
  breadthBucket,
  classifyEntryLocation,
  confidenceTier,
  extractPreEntryEnvironment,
  mfeR,
  preconditionsList,
  rvolBucket,
  sessionWindow
} from './winner-decomposition.util';
import { PullbackStabilityEngine } from '../entry-sequencing/pullback-stability.engine';

/** Discover predictive preconditions that precede large expansion moves. */
export class ContinuationPreconditionEngine {
  private readonly pullbackEngine = new PullbackStabilityEngine();

  analyze(signals: SignalSnapshot[], sampleCount: number): {
    eliteConditions: EliteEntryCondition[];
    acceptanceProfiles: ContinuationAcceptanceProfile[];
    matrix: ExpansionConditionMatrixRow[];
  } {
    return {
      eliteConditions: this.eliteEntryConditions(signals, sampleCount),
      acceptanceProfiles: this.acceptanceProfiles(signals, sampleCount),
      matrix: this.expansionMatrix(signals, sampleCount)
    };
  }

  private eliteEntryConditions(signals: SignalSnapshot[], sampleCount: number): EliteEntryCondition[] {
    const map = new Map<string, SignalSnapshot[]>();
    for (const s of signals) {
      const loc = classifyEntryLocation(s);
      const pre = extractPreEntryEnvironment(s, sampleCount);
      const key = `${loc}|${pre.narrative.continuationAcceptance}`;
      const bucket = map.get(key) ?? [];
      bucket.push(s);
      map.set(key, bucket);
    }

    return [...map.entries()]
      .map(([key, rows]) => {
        const [entryLocation, cont] = key.split('|');
        const pre = extractPreEntryEnvironment(rows[0], sampleCount);
        const wins = rows.filter(s => mfeR(s) >= 1).length;
        return {
          profile: `${entryLocation.replace(/_/g, ' ')} + ${cont}`,
          entryLocation: pre.entryLocation,
          preconditions: preconditionsList(pre),
          count: rows.length,
          avgR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
          winRate: round2((wins / rows.length) * 100),
          continuationPct: round2(rows.filter(s => s.evaluation?.hit1R).length / rows.length * 100),
          confidence: confidenceTier(rows.length)
        };
      })
      .sort((a, b) => b.avgR - a.avgR)
      .slice(0, 10);
  }

  private acceptanceProfiles(signals: SignalSnapshot[], sampleCount: number): ContinuationAcceptanceProfile[] {
    const map = new Map<string, SignalSnapshot[]>();
    for (const s of signals) {
      const pre = extractPreEntryEnvironment(s, sampleCount);
      const key = pre.narrative.continuationAcceptance;
      const bucket = map.get(key) ?? [];
      bucket.push(s);
      map.set(key, bucket);
    }

    return [...map.entries()]
      .map(([profile, rows]) => ({
        profile,
        count: rows.length,
        avgR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
        avgContinuationPct: round2(rows.filter(s => s.evaluation?.hit1R).length / rows.length * 100),
        preconditions: preconditionsList(extractPreEntryEnvironment(rows[0], sampleCount)),
        confidence: confidenceTier(rows.length)
      }))
      .sort((a, b) => b.avgR - a.avgR);
  }

  private expansionMatrix(signals: SignalSnapshot[], sampleCount: number): ExpansionConditionMatrixRow[] {
    const map = new Map<string, SignalSnapshot[]>();
    for (const s of signals) {
      const pre = extractPreEntryEnvironment(s, sampleCount);
      const pull = this.pullbackEngine.classify(s);
      const key = [
        rvolBucket(s.rvol ?? 0),
        breadthBucket(s.trendAlignment ?? 0),
        pre.narrative.stability >= 60 ? 'STABLE' : 'UNSTABLE',
        pull
      ].join('|');
      const bucket = map.get(key) ?? [];
      bucket.push(s);
      map.set(key, bucket);
    }

    return [...map.entries()]
      .map(([key, rows]) => {
        const [rvolBucket, breadthBucket, narrativeStability, pullbackDepth] = key.split('|');
        const contHits = rows.filter(s => s.evaluation?.hit1R || mfeR(s) >= 1).length;
        return {
          rvolBucket,
          breadthBucket,
          narrativeStability,
          pullbackDepth,
          continuationProbability: round2((contHits / rows.length) * 100),
          avgR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
          count: rows.length,
          confidence: confidenceTier(rows.length)
        };
      })
      .sort((a, b) => b.avgR - a.avgR)
      .slice(0, 24);
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
