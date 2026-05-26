import { PlaybookCandidate, PlaybookRelationship } from './playbook-candidate.models';
import { sequenceKey } from './playbook-sequence.util';

/** Detect overlapping, contradictory, and redundant playbook candidates. */
export class PlaybookRelationshipEngine {

  analyze(candidates: PlaybookCandidate[]): PlaybookRelationship[] {
    const rels: PlaybookRelationship[] = [];

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        const overlap = this.overlapPct(a, b);
        if (overlap >= 80) {
          rels.push({
            candidateA: a.id,
            candidateB: b.id,
            type: 'REDUNDANT',
            overlapPct: overlap,
            message: `${a.name} and ${b.name} are highly redundant (${overlap}% overlap)`
          });
        } else if (overlap >= 50) {
          rels.push({
            candidateA: a.id,
            candidateB: b.id,
            type: 'OVERLAP',
            overlapPct: overlap,
            message: `Partial overlap (${overlap}%) — review for competing entries`
          });
        }

        if (this.contradictory(a, b)) {
          rels.push({
            candidateA: a.id,
            candidateB: b.id,
            type: 'CONTRADICTORY',
            overlapPct: overlap,
            message: `Contradictory final setups: ${finalSetup(a)} vs ${finalSetup(b)} in similar conditions`
          });
        }

        if (this.competing(a, b)) {
          rels.push({
            candidateA: a.id,
            candidateB: b.id,
            type: 'COMPETING',
            overlapPct: overlap,
            message: 'Same opening window and regime — entries may compete for capital'
          });
        }
      }
    }

    return rels;
  }

  private overlapPct(a: PlaybookCandidate, b: PlaybookCandidate): number {
    const ka = sequenceKey(a.sequence);
    const kb = sequenceKey(b.sequence);
    if (ka === kb) return 100;
    const stepsA = ka.split('→');
    const stepsB = kb.split('→');
    const shared = stepsA.filter(s => stepsB.includes(s)).length;
    return Math.round((shared / Math.max(stepsA.length, stepsB.length)) * 100);
  }

  private contradictory(a: PlaybookCandidate, b: PlaybookCandidate): boolean {
    const fa = finalSetup(a);
    const fb = finalSetup(b);
    if (fa === fb) return false;
    const regimeOverlap = a.regimes.some(r => b.regimes.includes(r));
    if (!regimeOverlap) return false;
    const opp =
      (fa === 'INSTITUTIONAL_ACCELERATION' && fb === 'LATE_STAGE_EXHAUSTION') ||
      (fa === 'EARLY_CONTINUATION' && fb === 'LATE_STAGE_EXHAUSTION') ||
      (fa === 'TREND_RESUMPTION' && fb === 'LATE_STAGE_EXHAUSTION');
    return opp && a.expectancyR > 0 && b.expectancyR > 0;
  }

  private competing(a: PlaybookCandidate, b: PlaybookCandidate): boolean {
    const timeOverlap = a.bestTimeWindows.some(t => b.bestTimeWindows.includes(t));
    const regimeOverlap = a.regimes.some(r => b.regimes.includes(r));
    const symOverlap = a.bestSymbols.filter(s => b.bestSymbols.includes(s)).length >= 2;
    return timeOverlap && regimeOverlap && symOverlap && a.id !== b.id;
  }
}

function finalSetup(c: PlaybookCandidate): string {
  return c.sequence[c.sequence.length - 1]?.setup ?? '';
}
