import {
  PlaybookCandidate,
  PlaybookEvolutionEvent,
  PlaybookEvolutionState
} from './playbook-candidate.models';

/** Track whether discovered playbooks improve, decay, stabilize, or disappear. */
export class PlaybookEvolutionEngine {

  evolve(
    current: PlaybookCandidate[],
    previous: PlaybookCandidate[]
  ): { candidates: PlaybookCandidate[]; events: PlaybookEvolutionEvent[] } {
    const prevMap = new Map(previous.map(c => [c.id, c]));
    const events: PlaybookEvolutionEvent[] = [];
    const now = Date.now();

    const updated = current.map(c => {
      const prev = prevMap.get(c.id);
      if (!prev) {
        events.push({
          candidateId: c.id,
          at: now,
          from: 'DISCOVERED',
          to: c.evolutionState,
          expectancyR: c.expectancyR,
          sampleCount: c.sampleCount,
          message: 'New candidate discovered'
        });
        return c;
      }

      const nextState = this.resolveState(prev, c);
      if (nextState !== prev.evolutionState) {
        events.push({
          candidateId: c.id,
          at: now,
          from: prev.evolutionState,
          to: nextState,
          expectancyR: c.expectancyR,
          sampleCount: c.sampleCount,
          message: evolutionMessage(prev.evolutionState, nextState, c)
        });
      }

      return {
        ...c,
        evolutionState: nextState,
        promotionState: prev.promotionState,
        discoveredAt: prev.discoveredAt
      };
    });

    for (const prev of previous) {
      if (!current.some(c => c.id === prev.id)) {
        events.push({
          candidateId: prev.id,
          at: now,
          from: prev.evolutionState,
          to: 'DEPRECATED',
          expectancyR: prev.expectancyR,
          sampleCount: prev.sampleCount,
          message: 'Candidate no longer qualifies — pattern disappeared'
        });
      }
    }

    return { candidates: updated, events };
  }

  private resolveState(prev: PlaybookCandidate, curr: PlaybookCandidate): PlaybookEvolutionState {
    const expDelta = curr.expectancyR - prev.expectancyR;
    const sampleDelta = curr.sampleCount - prev.sampleCount;

    if (curr.confidence === 'IGNORE' || curr.expectancyR <= 0) return 'DEPRECATED';
    if (expDelta <= -0.25 && curr.expectancyR < prev.expectancyR) return 'WEAKENING';
    if (curr.confidence === 'STABLE' && curr.expectancyR >= 0.35 && curr.stability >= 60) return 'STABLE';
    if (curr.confidence === 'EXPERIMENTAL') return 'EXPERIMENTAL';
    if (sampleDelta >= 5 && expDelta >= 0.05) return curr.confidence === 'STABLE' ? 'STABLE' : 'DISCOVERED';
    return prev.evolutionState === 'WEAKENING' && expDelta > 0 ? 'DISCOVERED' : prev.evolutionState;
  }
}

function evolutionMessage(from: PlaybookEvolutionState, to: PlaybookEvolutionState, c: PlaybookCandidate): string {
  if (to === 'WEAKENING') return `Expectancy decaying (${c.expectancyR.toFixed(2)}R, n=${c.sampleCount})`;
  if (to === 'STABLE') return `Pattern stabilizing (+${c.expectancyR.toFixed(2)}R across ${c.uniqueSessions} sessions)`;
  if (to === 'DEPRECATED') return 'No longer meets qualification thresholds';
  if (to === 'EXPERIMENTAL') return 'Building sample depth — experimental only';
  return `Evolution ${from} → ${to}`;
}

export function weakeningCandidates(candidates: PlaybookCandidate[]): PlaybookCandidate[] {
  return candidates.filter(c => c.evolutionState === 'WEAKENING' || c.evolutionState === 'DEPRECATED');
}

export function emergingCandidates(candidates: PlaybookCandidate[]): PlaybookCandidate[] {
  return candidates
    .filter(c => c.evolutionState === 'DISCOVERED' || c.evolutionState === 'EXPERIMENTAL')
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 5);
}
