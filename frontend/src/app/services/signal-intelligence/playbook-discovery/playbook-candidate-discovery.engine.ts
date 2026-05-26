import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { avg, computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import {
  PlaybookCandidate,
  PlaybookConfidenceBand,
  PlaybookDiscoveryDiagnostics,
  PlaybookEvolutionState,
  PlaybookNearMiss,
  PlaybookSequenceStep
} from './playbook-candidate.models';
import {
  buildSequenceStep,
  extractSessionSequences,
  groupBySession,
  sequenceBucketKey,
  sequenceDescription,
  sequenceKey,
  sequenceName
} from './playbook-sequence.util';
import { computePlaybookQualityScore, confidenceBand } from './playbook-quality-score.util';
import { classifyEntryWindow, ENTRY_WINDOW_LABELS } from '../adaptive-entry/adaptive-entry.util';

/** Statistical safety — Phase 139 discovery floors. */
export const MIN_QUALIFY_SAMPLES = 10;
export const MIN_EXPECTANCY_R = 0.35;
export const MAX_FAKEOUT_RATE = 45;
export const MAX_MAE_R = 0.85;
export const MIN_CONTINUATION_HIT1 = 40;
export const MIN_UNIQUE_SYMBOLS = 3;
export const MIN_UNIQUE_SESSIONS = 3;

const falseBreakout = new FalseBreakoutAnalyticsEngine();

interface SequenceBucket {
  key: string;
  fingerprint: string;
  steps: PlaybookSequenceStep[];
  instances: SignalSnapshot[][];
}

export interface PlaybookDiscoveryResult {
  candidates: PlaybookCandidate[];
  diagnostics: PlaybookDiscoveryDiagnostics;
  nearMisses: PlaybookNearMiss[];
}

/** Detect recurring profitable condition sequences — discovery only. */
export class PlaybookCandidateDiscoveryEngine {

  discover(signals: SignalSnapshot[], lookbackDays: number): PlaybookDiscoveryResult {
    const all = signals.length;
    const evaluated = evaluatedSignals(signals);
    const sessions = groupBySession(evaluated);
    const buckets = new Map<string, SequenceBucket>();

    for (const session of sessions) {
      for (const seq of extractSessionSequences(session.signals)) {
        const steps = seq.map((s, i) => buildSequenceStep(s, i > 0 ? seq[i - 1] : undefined));
        const key = sequenceBucketKey(steps);
        const bucket = buckets.get(key) ?? {
          key,
          fingerprint: sequenceKey(steps),
          steps,
          instances: []
        };
        bucket.instances.push(seq);
        buckets.set(key, bucket);
      }
    }

    const candidates: PlaybookCandidate[] = [];
    const nearMisses: PlaybookNearMiss[] = [];
    let bucketsAboveMin = 0;
    let rejectedLowExp = 0;
    let rejectedStability = 0;
    let rejectedFakeout = 0;
    const now = Date.now();

    for (const bucket of buckets.values()) {
      const lastSignals = bucket.instances.map(seq => seq[seq.length - 1]);
      const n = lastSignals.length;
      const confidence = confidenceBand(n);
      if (confidence === 'IGNORE') continue;

      bucketsAboveMin++;
      const metrics = this.metrics(lastSignals);
      const failReason = this.failReason(metrics, lastSignals, bucket.steps);

      if (failReason) {
        if (metrics.expectancyR <= MIN_EXPECTANCY_R) rejectedLowExp++;
        else if (metrics.fakeoutRate >= MAX_FAKEOUT_RATE) rejectedFakeout++;
        else rejectedStability++;

        if (n >= MIN_QUALIFY_SAMPLES && metrics.expectancyR > 0) {
          nearMisses.push({
            name: sequenceName(bucket.steps),
            sampleCount: n,
            expectancyR: metrics.expectancyR,
            reason: failReason
          });
        }
        continue;
      }

      const symbols = new Set(lastSignals.map(s => s.symbol));
      const sessionKeys = new Set(lastSignals.map(s => sessionKeyFromTs(s.timestamp)));
      const stability = this.computeStability(lastSignals, sessionKeys.size);

      candidates.push({
        id: `PB_${bucket.key.slice(0, 48).replace(/[^a-zA-Z0-9→:+_-]/g, '_')}`,
        name: sequenceName(bucket.steps),
        description: sequenceDescription(bucket.steps),
        sequence: bucket.steps,
        sampleCount: n,
        winRate: metrics.winRate,
        expectancyR: metrics.expectancyR,
        avgMfe: metrics.avgMfe,
        avgMae: metrics.avgMae,
        continuationStrength: metrics.continuationStrength,
        fakeoutRate: metrics.fakeoutRate,
        confidence,
        stability,
        qualityScore: computePlaybookQualityScore({
          expectancyR: metrics.expectancyR,
          stability,
          sampleCount: n,
          continuationStrength: metrics.continuationStrength,
          avgMae: metrics.avgMae,
          uniqueSymbols: symbols.size,
          fakeoutRate: metrics.fakeoutRate
        }),
        regimes: topValues(lastSignals.map(s => s.marketRegime)),
        bestTimeWindows: topValues(lastSignals.map(s => buildSequenceStep(s).timeWindow)),
        bestSymbols: topSymbols(lastSignals),
        suppressionConditions: this.suppressionHints(bucket.steps, metrics.fakeoutRate, metrics.avgMae),
        optimalEntryZones: this.entryZonesFor(lastSignals, 'best'),
        avoidEntryZones: this.entryZonesFor(lastSignals, 'avoid'),
        uniqueSymbols: symbols.size,
        uniqueSessions: sessionKeys.size,
        evolutionState: evolutionFromConfidence(confidence),
        promotionState: 'DISCOVERED',
        discoveredAt: now,
        lastUpdated: now,
        advisoryOnly: true
      });
    }

    nearMisses.sort((a, b) => b.expectancyR - a.expectancyR);

    const diagnostics: PlaybookDiscoveryDiagnostics = {
      totalSignals: all,
      evaluatedSignals: evaluated.length,
      sessionGroups: sessions.length,
      rawSequenceBuckets: buckets.size,
      bucketsAboveMinSamples: bucketsAboveMin,
      rejectedLowExpectancy: rejectedLowExp,
      rejectedStability: rejectedStability,
      rejectedFakeout: rejectedFakeout,
      qualified: candidates.length,
      message: diagnosticMessage(all, evaluated.length, buckets.size, bucketsAboveMin, candidates.length)
    };

    return {
      candidates: candidates.sort((a, b) => b.qualityScore - a.qualityScore || b.expectancyR - a.expectancyR),
      diagnostics,
      nearMisses: nearMisses.slice(0, 8)
    };
  }

  private metrics(lastSignals: SignalSnapshot[]) {
    const n = lastSignals.length;
    const wins = lastSignals.filter(s => s.evaluation!.status === 'WIN');
    const hit1 = lastSignals.filter(s => s.evaluation!.hit1R);
    const falseOnes = lastSignals.filter(s => falseBreakout.isFalseBreakout(s));
    return {
      expectancyR: computeExpectancyR(lastSignals),
      winRate: pct(wins.length, n),
      continuationStrength: pct(hit1.length, n),
      fakeoutRate: pct(falseOnes.length, n),
      avgMfe: avg(lastSignals.map(s => s.evaluation!.mfeR)),
      avgMae: avg(lastSignals.map(s => s.evaluation!.maeR))
    };
  }

  private failReason(
    m: ReturnType<PlaybookCandidateDiscoveryEngine['metrics']>,
    lastSignals: SignalSnapshot[],
    steps: PlaybookSequenceStep[]
  ): string | null {
    if (m.expectancyR <= MIN_EXPECTANCY_R) {
      return `Expectancy ${m.expectancyR.toFixed(2)}R below +${MIN_EXPECTANCY_R}R threshold`;
    }
    if (m.fakeoutRate >= MAX_FAKEOUT_RATE) {
      return `Fakeout rate ${m.fakeoutRate}% exceeds ${MAX_FAKEOUT_RATE}%`;
    }
    if (Math.abs(m.avgMae) > MAX_MAE_R) {
      return `MAE ${Math.abs(m.avgMae).toFixed(2)}R too deep`;
    }
    if (m.continuationStrength < MIN_CONTINUATION_HIT1) {
      return `Continuation ${m.continuationStrength}% below ${MIN_CONTINUATION_HIT1}%`;
    }
    const symbols = new Set(lastSignals.map(s => s.symbol));
    if (symbols.size < MIN_UNIQUE_SYMBOLS) {
      return `Only ${symbols.size} symbol(s) — need ≥${MIN_UNIQUE_SYMBOLS} for cross-symbol stability`;
    }
    const sessions = new Set(lastSignals.map(s => sessionKeyFromTs(s.timestamp)));
    if (sessions.size < MIN_UNIQUE_SESSIONS) {
      return `Only ${sessions.size} session(s) — need ≥${MIN_UNIQUE_SESSIONS} recurring days`;
    }
    if (steps.length < 2) {
      return 'Sequence too short';
    }
    return null;
  }

  private computeStability(signals: SignalSnapshot[], sessionCount: number): number {
    const byWeek = new Map<string, number>();
    for (const s of signals) {
      const w = weekKey(s.timestamp);
      byWeek.set(w, (byWeek.get(w) ?? 0) + 1);
    }
    const weeks = byWeek.size;
    const spread = weeks >= 4 ? 40 : weeks * 10;
    const sessionScore = Math.min(30, sessionCount * 3);
    const expVariance = variance(signals.map(s => s.evaluation!.mfeR - s.evaluation!.maeR));
    const varScore = Math.max(0, 30 - expVariance * 15);
    return Math.round(Math.min(100, spread + sessionScore + varScore));
  }

  private suppressionHints(steps: PlaybookSequenceStep[], fakeoutRate: number, avgMae: number): string[] {
    const hints: string[] = [];
    if (steps.some(s => s.regime === 'CHOP')) hints.push('Avoid in sustained chop without sequence confirmation');
    if (steps.some(s => s.contextTags.includes('HIGH_RVOL'))) hints.push('Reduce size when RVOL exhaustion present');
    if (fakeoutRate > 30) hints.push('Elevated fakeout — wait for second-leg confirmation');
    if (Math.abs(avgMae) > 0.55) hints.push('MAE elevated — use tighter invalidation');
    if (steps.some(s => s.contextTags.includes('WEAK_BREADTH'))) hints.push('Suppress when breadth diverges');
    return hints;
  }

  private entryZonesFor(signals: SignalSnapshot[], mode: 'best' | 'avoid'): string[] {
    const buckets = new Map<string, SignalSnapshot[]>();
    for (const s of signals) {
      const w = classifyEntryWindow(s);
      buckets.set(w, [...(buckets.get(w) ?? []), s]);
    }
    const ranked = [...buckets.entries()]
      .map(([window, bucket]) => ({ label: ENTRY_WINDOW_LABELS[window as import('../adaptive-entry/adaptive-entry.models').EntryWindow], exp: computeExpectancyR(bucket) }))
      .sort((a, b) => mode === 'best' ? b.exp - a.exp : a.exp - b.exp);
    return ranked.slice(0, 3).map(r => r.label);
  }
}

function evolutionFromConfidence(c: PlaybookConfidenceBand): PlaybookEvolutionState {
  switch (c) {
    case 'EXPERIMENTAL': return 'EXPERIMENTAL';
    case 'DEVELOPING': return 'DISCOVERED';
    case 'STABLE': return 'STABLE';
    default: return 'DISCOVERED';
  }
}

function topValues(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
}

function topSymbols(signals: SignalSnapshot[]): string[] {
  const counts = new Map<string, number>();
  for (const s of signals) counts.set(s.symbol, (counts.get(s.symbol) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
}

function sessionKeyFromTs(ts: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(ts));
}

function weekKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-W${Math.floor(d.getUTCDate() / 7)}`;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
}

function diagnosticMessage(
  total: number,
  evaluated: number,
  buckets: number,
  aboveMin: number,
  qualified: number
): string {
  if (evaluated < 10) {
    return 'Few evaluated signals in this browser. Edge Lab history may already be loaded — click Load All 60D History to replay (skips IBKR if candles exist).';
  }
  if (buckets === 0) {
    return 'No multi-step sequences found. Need ≥2 evaluated signals same symbol/day within 120 minutes.';
  }
  if (aboveMin === 0) {
    return 'Sequences found but none reach 10 samples. Load more 60D history across watchlist symbols.';
  }
  if (qualified === 0) {
    return 'Patterns detected but none pass all thresholds (+0.35R, 3+ symbols, 3+ sessions, low fakeout). See near-misses below.';
  }
  return `${qualified} qualified candidate(s) from ${evaluated} evaluated signals.`;
}
