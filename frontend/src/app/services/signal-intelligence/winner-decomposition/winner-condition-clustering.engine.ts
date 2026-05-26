import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import {
  ExpansionNarrativeProfile,
  SuppressedWinnerPattern,
  TrendPersistenceAnalytic
} from './winner-decomposition.models';
import {
  classifyEntryLocation,
  confidenceTier,
  extractPreEntryEnvironment,
  mfeR
} from './winner-decomposition.util';
import { round2 } from '../adaptive-calibration/adaptive-calibration.util';

/** Cluster expansion winners by narrative + entry location preconditions. */
export class WinnerConditionClusteringEngine {

  clusterNarratives(signals: SignalSnapshot[], sampleCount: number): ExpansionNarrativeProfile[] {
    const map = new Map<string, SignalSnapshot[]>();
    for (const s of signals) {
      const pre = extractPreEntryEnvironment(s, sampleCount);
      const key = pre.narrative.path.split('→')[0]?.trim() || pre.entryLocation;
      const bucket = map.get(key) ?? [];
      bucket.push(s);
      map.set(key, bucket);
    }

    return [...map.entries()]
      .map(([narrative, rows]) => this.narrativeProfile(narrative, rows))
      .sort((a, b) => b.avgR - a.avgR)
      .slice(0, 10);
  }

  clusterSuppressedPatterns(signals: SignalSnapshot[], sampleCount: number): SuppressedWinnerPattern[] {
    const map = new Map<string, SignalSnapshot[]>();
    for (const s of signals) {
      const pre = extractPreEntryEnvironment(s, sampleCount);
      if (!pre.governance.suppressedWinner) continue;
      const key = pre.governance.suppressionReasons[0] ?? pre.governance.decision;
      const bucket = map.get(key) ?? [];
      bucket.push(s);
      map.set(key, bucket);
    }

    return [...map.entries()]
      .map(([pattern, rows]) => ({
        pattern,
        count: rows.length,
        avgMissedR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
        topDecisions: [...new Set(rows.map(s => extractPreEntryEnvironment(s, sampleCount).governance.decision))],
        confidence: confidenceTier(rows.length),
        examples: rows.slice(0, 3).map(s => `${s.symbol} ${classifyEntryLocation(s)} +${mfeR(s).toFixed(1)}R`)
      }))
      .sort((a, b) => b.avgMissedR - a.avgMissedR)
      .slice(0, 8);
  }

  trendPersistence(signals: SignalSnapshot[], sampleCount: number): TrendPersistenceAnalytic[] {
    const labels = [
      { label: 'Trend day + opening drive', match: (s: SignalSnapshot) => (s.sessionTimeMinutes ?? 999) <= 45 && s.marketRegime === 'TREND' },
      { label: 'VWAP hold continuation', match: (s: SignalSnapshot) => classifyEntryLocation(s) === 'VWAP_RECLAIM' },
      { label: 'Second-leg expansion', match: (s: SignalSnapshot) => classifyEntryLocation(s) === 'SECOND_LEG' },
      { label: 'Low fakeout runner', match: (s: SignalSnapshot) => extractPreEntryEnvironment(s, sampleCount).narrative.fakeoutRisk === 'LOW' }
    ];

    return labels.map(({ label, match }) => {
      const rows = signals.filter(match);
      const wins = rows.filter(s => mfeR(s) >= 1).length;
      return {
        label,
        count: rows.length,
        avgR: rows.length ? round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length) : 0,
        continuationRate: rows.length ? round2((wins / rows.length) * 100) : 0,
        confidence: confidenceTier(rows.length)
      };
    }).filter(r => r.count > 0);
  }

  private narrativeProfile(narrative: string, rows: SignalSnapshot[]): ExpansionNarrativeProfile {
    const wins = rows.filter(s => s.evaluation?.status === 'WIN' || mfeR(s) >= 0.5).length;
    return {
      narrative,
      count: rows.length,
      avgR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
      winRate: round2((wins / rows.length) * 100),
      continuationPct: round2(rows.filter(s => s.evaluation?.hit1R).length / rows.length * 100),
      confidence: confidenceTier(rows.length),
      exampleSymbols: [...new Set(rows.map(s => s.symbol))].slice(0, 5)
    };
  }
}
