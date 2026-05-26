import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { RecommendedEntryProfile } from './winner-decomposition.models';
import {
  classifyEntryLocation,
  confidenceTier,
  extractPreEntryEnvironment,
  mfeR,
  preconditionsList
} from './winner-decomposition.util';
import { isAvoidDecision, isWaitDecision } from '../adaptive-calibration/adaptive-calibration.util';

/** Determine where FULL_EXECUTION should have occurred on expansion sessions. */
export class EntryRecaptureEngine {

  analyze(signals: SignalSnapshot[], sampleCount: number): RecommendedEntryProfile[] {
    const candidates = signals.filter(s => {
      const pre = extractPreEntryEnvironment(s, sampleCount);
      return mfeR(s) >= 2
        && (isWaitDecision(pre.governance.decision) || isAvoidDecision(pre.governance.decision) || !pre.governance.wouldFullExecution);
    });

    const map = new Map<string, SignalSnapshot[]>();
    for (const s of candidates) {
      const loc = classifyEntryLocation(s);
      const pre = extractPreEntryEnvironment(s, sampleCount);
      const key = `${loc}|${pre.narrative.continuationAcceptance}`;
      const bucket = map.get(key) ?? [];
      bucket.push(s);
      map.set(key, bucket);
    }

    return [...map.entries()]
      .map(([key, rows]) => {
        const [locStr] = key.split('|');
        const pre = extractPreEntryEnvironment(rows[0], sampleCount);
        const triggers = [
          ...preconditionsList(pre),
          'Governance should upgrade to FULL_EXECUTION when preconditions align',
          `Missed avg +${round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length)}R`
        ];
        return {
          profile: `Recapture: ${locStr.replace(/_/g, ' ')}`,
          entryLocation: pre.entryLocation,
          triggerConditions: triggers,
          avgR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
          sampleCount: rows.length,
          confidence: confidenceTier(rows.length)
        };
      })
      .sort((a, b) => b.avgR - a.avgR)
      .slice(0, 8);
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
