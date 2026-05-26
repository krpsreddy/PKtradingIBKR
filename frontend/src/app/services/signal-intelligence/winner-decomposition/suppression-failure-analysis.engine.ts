import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import {
  FalseAvoidPattern,
  GovernanceFailure,
  MissedWinner
} from './winner-decomposition.models';
import {
  classifyEntryLocation,
  confidenceTier,
  extractPreEntryEnvironment,
  mfeR,
  sessionDateFromTs
} from './winner-decomposition.util';
import { isAvoidDecision, isWaitDecision } from '../adaptive-calibration/adaptive-calibration.util';

/** Analyze governance decisions that incorrectly suppressed expansion winners. */
export class SuppressionFailureAnalysisEngine {

  analyzeMissedWinners(signals: SignalSnapshot[], sampleCount: number): MissedWinner[] {
    return signals
      .filter(s => {
        const pre = extractPreEntryEnvironment(s, sampleCount);
        return pre.governance.suppressedWinner || (
          isLargeEnough(s) && (isWaitDecision(pre.governance.decision) || isAvoidDecision(pre.governance.decision))
        );
      })
      .map(s => this.toMissedWinner(s, sampleCount))
      .sort((a, b) => b.outcomeR - a.outcomeR)
      .slice(0, 20);
  }

  analyzeGovernanceFailures(signals: SignalSnapshot[], sampleCount: number): GovernanceFailure[] {
    const buckets: Array<{ type: string; desc: string; match: (s: SignalSnapshot) => boolean }> = [
      {
        type: 'EXHAUSTED mislabel',
        desc: 'Winners labeled exhausted/extended when continuation persisted',
        match: s => s.extendedEntry === true && isLargeEnough(s)
      },
      {
        type: 'Continuation over-penalized',
        desc: 'Governance waited through valid continuation acceptance',
        match: s => {
          const pre = extractPreEntryEnvironment(s, sampleCount);
          return isWaitDecision(pre.governance.decision)
            && pre.narrative.continuationAcceptance !== 'FAILING_ACCEPTANCE'
            && isLargeEnough(s);
        }
      },
      {
        type: 'Fakeout fear too strong',
        desc: 'Low fakeout risk runners suppressed by trap guards',
        match: s => {
          const pre = extractPreEntryEnvironment(s, sampleCount);
          return pre.narrative.fakeoutRisk === 'LOW' && isAvoidDecision(pre.governance.decision) && isLargeEnough(s);
        }
      },
      {
        type: 'Continuation reward too weak',
        desc: 'High-R moves after REDUCE/WAIT without trap confirmation',
        match: s => {
          const pre = extractPreEntryEnvironment(s, sampleCount);
          return mfeR(s) >= 2.5 && isWaitDecision(pre.governance.decision);
        }
      }
    ];

    return buckets
      .map(({ type, desc, match }) => {
        const rows = signals.filter(match);
        return {
          failureType: type,
          count: rows.length,
          avgMissedR: rows.length ? round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length) : 0,
          description: desc,
          confidence: confidenceTier(rows.length)
        };
      })
      .filter(r => r.count > 0)
      .sort((a, b) => b.avgMissedR - a.avgMissedR);
  }

  analyzeFalseAvoids(signals: SignalSnapshot[], sampleCount: number): FalseAvoidPattern[] {
    const map = new Map<string, SignalSnapshot[]>();
    for (const s of signals) {
      const pre = extractPreEntryEnvironment(s, sampleCount);
      if (!isAvoidDecision(pre.governance.decision) || !isLargeEnough(s)) continue;
      const key = pre.governance.suppressionReasons.join(' + ') || pre.governance.reason;
      const bucket = map.get(key) ?? [];
      bucket.push(s);
      map.set(key, bucket);
    }

    return [...map.entries()]
      .map(([pattern, rows]) => ({
        pattern,
        count: rows.length,
        avgMissedR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
        confidence: confidenceTier(rows.length)
      }))
      .sort((a, b) => b.avgMissedR - a.avgMissedR)
      .slice(0, 8);
  }

  private toMissedWinner(s: SignalSnapshot, sampleCount: number): MissedWinner {
    const pre = extractPreEntryEnvironment(s, sampleCount);
    const r = mfeR(s);
    return {
      symbol: s.symbol,
      sessionDate: sessionDateFromTs(s.timestamp),
      timestamp: s.timestamp,
      decision: pre.governance.decision,
      suppressionReason: pre.governance.suppressionReasons.join('; ') || pre.governance.reason,
      outcomeR: r,
      whatHappenedAfter: r >= 3 ? `Expanded +${r.toFixed(1)}R — elite continuation` : `Ran +${r.toFixed(1)}R after ${pre.governance.decision}`,
      shouldHaveBeen: pre.governance.wouldFullExecution ? 'FULL_EXECUTION' : 'REDUCE_SIZE or earlier WAIT exit',
      entryLocation: pre.entryLocation,
      narrative: pre.narrative.path,
      convictionBand: pre.governance.convictionBand
    };
  }
}

function isLargeEnough(s: SignalSnapshot): boolean {
  return mfeR(s) >= 2 || s.evaluation?.hit2R === true;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
