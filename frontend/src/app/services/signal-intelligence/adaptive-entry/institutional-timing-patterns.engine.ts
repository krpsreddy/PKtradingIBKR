import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals } from '../signal-intelligence.math';
import { InstitutionalTimingInsight, InstitutionalTimingPattern } from './adaptive-entry.models';
import { inferInstitutionalTiming, round2 } from './adaptive-entry.util';

const PATTERN_LABELS: Record<InstitutionalTimingPattern, string> = {
  ABSORPTION_PULLBACK: 'Absorption Pullback',
  SECOND_LEG_ACCEPTANCE: 'Second Leg Acceptance',
  RECLAIM_HOLD: 'Reclaim Hold',
  OPEN_DRIVE_TRAP: 'Open Drive Trap',
  POST_ACCEPTANCE_CONTINUATION: 'Post-Acceptance Continuation'
};

/** Infer where institutions likely participate within narratives. */
export class InstitutionalTimingPatternsEngine {
  analyze(signals: SignalSnapshot[]): InstitutionalTimingInsight[] {
    const evaluated = evaluatedSignals(signals);
    const buckets = new Map<InstitutionalTimingPattern, SignalSnapshot[]>();

    for (const s of evaluated) {
      const pattern = inferInstitutionalTiming(s);
      if (!pattern) continue;
      buckets.set(pattern, [...(buckets.get(pattern) ?? []), s]);
    }

    return [...buckets.entries()]
      .map(([pattern, bucket]) => ({
        pattern,
        label: PATTERN_LABELS[pattern],
        sampleCount: bucket.length,
        expectancyR: round2(computeExpectancyR(bucket)),
        note: this.note(pattern, computeExpectancyR(bucket))
      }))
      .sort((a, b) => b.expectancyR - a.expectancyR);
  }

  private note(pattern: InstitutionalTimingPattern, exp: number): string {
    if (pattern === 'RECLAIM_HOLD') return exp > 0 ? 'Institutions likely accumulating on reclaim hold' : 'Reclaim hold underperforming in sample';
    if (pattern === 'SECOND_LEG_ACCEPTANCE') return 'Second-leg participation aligns with continuation institutions';
    if (pattern === 'OPEN_DRIVE_TRAP') return 'Open drive trap — distribution likely complete';
    if (pattern === 'ABSORPTION_PULLBACK') return 'Pullback absorption — patient entry zone';
    return 'Post-acceptance institutional continuation';
  }
}
