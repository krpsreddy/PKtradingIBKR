import {
  BucketEdgeStats,
  EdgeConfidenceLevel,
  LateEntryPenalty,
  OverallEdgeStats,
  RegimeEdgeStats,
  SetupEdgeStats,
  SymbolEdgeCompressedSummary
} from './models/symbol-edge.models';
import {
  SIGNAL_INTELLIGENCE_LOOKBACK_DAYS,
  SignalSnapshot
} from '../models/signal-intelligence.model';
import { avg, computeExpectancyR, confidenceFromCount, evaluatedSignals as getEvaluated, pct } from '../services/signal-intelligence/signal-intelligence.math';

/** Deterministic symbol edge aggregates from evaluated signal intelligence snapshots. */
export function buildSymbolEdgeSummary(
  symbol: string,
  signals: SignalSnapshot[],
  lookbackDays = SIGNAL_INTELLIGENCE_LOOKBACK_DAYS
): SymbolEdgeCompressedSummary {
  const evaluatedRows = getEvaluated(signals);
  const overall = overallStats(evaluatedRows);
  const bySetup = bySetupType(signals);
  const byRegime = byRegimeType(signals);
  const byEntryQuality = byEntryQualityBucket(signals);
  const byRvol = byRvolBucket(signals);
  const byTimeOfDay = byTimeOfDayBucket(signals);
  const byPremarket = byPremarketExtension(signals);

  const premarketExtension: Record<string, BucketEdgeStats> = {};
  for (const b of byPremarket) {
    premarketExtension[b.bucket] = b;
  }

  return {
    symbol: symbol.toUpperCase(),
    lookbackDays,
    evaluatedTrades: evaluatedRows.length,
    overall,
    bestSetup: pickSetupExtreme(bySetup, true),
    worstSetup: pickSetupExtreme(bySetup, false),
    bestRegime: pickRegimeExtreme(byRegime, true),
    worstRegime: pickRegimeExtreme(byRegime, false),
    bestTimeWindow: bestTimeWindow(byTimeOfDay),
    lateEntryPenalty: lateEntryPenalty(byEntryQuality),
    premarketExtension,
    bySetup,
    byRegime,
    byEntryQuality,
    byRvol,
    byTimeOfDay
  };
}

function overallStats(rows: SignalSnapshot[]): OverallEdgeStats {
  if (!rows.length) {
    return emptyOverall();
  }
  const wins = rows.filter(s => s.evaluation!.status === 'WIN');
  const hit1 = rows.filter(s => s.evaluation!.hit1R);
  const hit2 = rows.filter(s => s.evaluation!.hit2R);
  const conf = confidenceFromCount(rows.length).level as EdgeConfidenceLevel;

  return {
    trades: rows.length,
    winRate: pct(wins.length, rows.length),
    expectancy: computeExpectancyR(rows),
    avgMfe: avg(rows.map(s => s.evaluation!.mfeR)),
    avgMae: avg(rows.map(s => s.evaluation!.maeR)),
    hit1RRate: pct(hit1.length, rows.length),
    hit2RRate: pct(hit2.length, rows.length),
    confidence: conf
  };
}

function emptyOverall(): OverallEdgeStats {
  return {
    trades: 0, winRate: 0, expectancy: 0, avgMfe: 0, avgMae: 0,
    hit1RRate: 0, hit2RRate: 0, confidence: 'LOW'
  };
}

function bySetupType(signals: SignalSnapshot[]): SetupEdgeStats[] {
  const types = [...new Set(signals.map(s => s.signalType))];
  return types
    .map(t => setupRow(t, signals.filter(s => s.signalType === t)))
    .filter(r => r.sample > 0)
    .sort((a, b) => b.expectancy - a.expectancy);
}

function setupRow(type: string, rows: SignalSnapshot[]): SetupEdgeStats {
  const evaluatedRows = getEvaluated(rows);
  const wins = evaluatedRows.filter(s => s.evaluation!.status === 'WIN');
  const conf = confidenceFromCount(evaluatedRows.length).level as EdgeConfidenceLevel;
  return {
    type,
    sample: evaluatedRows.length,
    winRate: pct(wins.length, evaluatedRows.length),
    expectancy: computeExpectancyR(rows),
    avgMfe: avg(evaluatedRows.map(s => s.evaluation!.mfeR)),
    avgMae: avg(evaluatedRows.map(s => s.evaluation!.maeR)),
    confidence: conf
  };
}

function byRegimeType(signals: SignalSnapshot[]): RegimeEdgeStats[] {
  const regimes = [...new Set(signals.map(s => s.marketRegime))];
  return regimes
    .map(r => regimeRow(r, signals.filter(s => s.marketRegime === r)))
    .filter(r => r.sample > 0)
    .sort((a, b) => b.expectancy - a.expectancy);
}

function regimeRow(name: string, rows: SignalSnapshot[]): RegimeEdgeStats {
  const evaluatedRows = getEvaluated(rows);
  const wins = evaluatedRows.filter(s => s.evaluation!.status === 'WIN');
  const contWins = wins.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
  const contQuality = evaluatedRows.length
    ? Math.round((contWins.length / evaluatedRows.length) * 1000) / 10
    : 0;
  return {
    name,
    sample: evaluatedRows.length,
    winRate: pct(wins.length, evaluatedRows.length),
    expectancy: computeExpectancyR(rows),
    continuationQuality: contQuality,
    confidence: confidenceFromCount(evaluatedRows.length).level as EdgeConfidenceLevel
  };
}

function mapEntryQuality(s: SignalSnapshot): string {
  if (s.extendedEntry && s.captureStage === 'ENTERED') return 'CHASE';
  if (s.captureStage === 'ENTERED') return 'LATE';
  if (s.captureStage === 'TRIGGERED') return 'GOOD';
  return 'IDEAL';
}

function byEntryQualityBucket(signals: SignalSnapshot[]): BucketEdgeStats[] {
  return ['IDEAL', 'GOOD', 'LATE', 'CHASE'].map(q =>
    bucketRow(q, signals.filter(s => mapEntryQuality(s) === q))
  ).filter(b => b.sample > 0);
}

function byRvolBucket(signals: SignalSnapshot[]): BucketEdgeStats[] {
  const buckets: { label: string; match: (s: SignalSnapshot) => boolean }[] = [
    { label: '<1.5', match: s => s.rvol < 1.5 },
    { label: '1.5–3', match: s => s.rvol >= 1.5 && s.rvol < 3 },
    { label: '3–5', match: s => s.rvol >= 3 && s.rvol < 5 },
    { label: '>5', match: s => s.rvol >= 5 }
  ];
  return buckets.map(b => bucketRow(b.label, signals.filter(b.match))).filter(r => r.sample > 0);
}

function byTimeOfDayBucket(signals: SignalSnapshot[]): BucketEdgeStats[] {
  const buckets: { label: string; match: (m: number) => boolean }[] = [
    { label: '9:30–9:45', match: m => m >= 0 && m < 15 },
    { label: '9:45–10:15', match: m => m >= 15 && m < 45 },
    { label: '10:15–11:00', match: m => m >= 45 && m < 90 },
    { label: '11:00+', match: m => m >= 90 }
  ];
  return buckets.map(b =>
    bucketRow(b.label, signals.filter(s => {
      const m = s.sessionTimeMinutes ?? 0;
      return b.match(m);
    }))
  ).filter(r => r.sample > 0);
}

/** Premarket extension proxy: VWAP distance % at signal capture. */
function premarketExtensionPct(s: SignalSnapshot): number {
  return Math.abs(s.vwapDistance ?? 0) * 100;
}

function premarketBucket(pct: number): string {
  if (pct < 2) return '<2%';
  if (pct < 5) return '2–5%';
  if (pct < 8) return '5–8%';
  return '>8%';
}

function byPremarketExtension(signals: SignalSnapshot[]): BucketEdgeStats[] {
  const labels = ['<2%', '2–5%', '5–8%', '>8%'];
  return labels.map(label =>
    bucketRow(label, signals.filter(s => premarketBucket(premarketExtensionPct(s)) === label))
  ).filter(r => r.sample > 0);
}

function bucketRow(bucket: string, rows: SignalSnapshot[]): BucketEdgeStats {
  const evaluatedRows = getEvaluated(rows);
  const wins = evaluatedRows.filter(s => s.evaluation!.status === 'WIN');
  const losses = evaluatedRows.filter(s => s.evaluation!.status === 'LOSS');
  const cont = wins.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
  return {
    bucket,
    sample: evaluatedRows.length,
    winRate: pct(wins.length, evaluatedRows.length),
    expectancy: computeExpectancyR(rows),
    avgMfe: avg(evaluatedRows.map(s => s.evaluation!.mfeR)),
    avgMae: avg(evaluatedRows.map(s => s.evaluation!.maeR)),
    failureRate: pct(losses.length, evaluatedRows.length),
    continuationRate: evaluatedRows.length ? pct(cont.length, evaluatedRows.length) : 0,
    confidence: confidenceFromCount(evaluatedRows.length).level as EdgeConfidenceLevel
  };
}

function lateEntryPenalty(byEntry: BucketEdgeStats[]): LateEntryPenalty {
  const idealRows = byEntry.filter(b => b.bucket === 'IDEAL' || b.bucket === 'GOOD');
  const lateRows = byEntry.filter(b => b.bucket === 'LATE' || b.bucket === 'CHASE');
  const ideal = idealRows.length ? avg(idealRows.map(r => r.expectancy)) : 0;
  const late = lateRows.length ? avg(lateRows.map(r => r.expectancy)) : 0;
  const drop = ideal > 0.01 ? Math.min(99, Math.max(0, (1 - late / ideal) * 100)) : 0;
  return {
    idealExpectancy: Math.round(ideal * 100) / 100,
    lateExpectancy: Math.round(late * 100) / 100,
    expectancyDropPct: Math.round(drop * 10) / 10
  };
}

function bestTimeWindow(byTime: BucketEdgeStats[]): string {
  const best = byTime.filter(b => b.sample >= 3).sort((a, b) => b.expectancy - a.expectancy)[0];
  return best?.bucket ?? '—';
}

function pickSetupExtreme(rows: SetupEdgeStats[], best: boolean): SetupEdgeStats | null {
  const eligible = rows.filter(r => r.sample >= 3);
  if (!eligible.length) return null;
  return eligible.sort((a, b) => best ? b.expectancy - a.expectancy : a.expectancy - b.expectancy)[0];
}

function pickRegimeExtreme(rows: RegimeEdgeStats[], best: boolean): RegimeEdgeStats | null {
  const eligible = rows.filter(r => r.sample >= 3);
  if (!eligible.length) return null;
  return eligible.sort((a, b) => best ? b.expectancy - a.expectancy : a.expectancy - b.expectancy)[0];
}
