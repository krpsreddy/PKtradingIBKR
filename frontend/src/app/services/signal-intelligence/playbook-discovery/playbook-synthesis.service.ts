import { Injectable } from '@angular/core';
import { PlaybookAiSummary, PlaybookCandidate, PlaybookRelationship } from './playbook-candidate.models';

/** Deterministic playbook synthesis — summarizes statistics only, no invention. */
@Injectable({ providedIn: 'root' })
export class PlaybookSynthesisService {

  synthesize(
    candidates: PlaybookCandidate[],
    relationships: PlaybookRelationship[]
  ): PlaybookAiSummary {
    const top = candidates[0];
    const observations: string[] = [];

    if (!top) {
      return {
        summary: 'Insufficient evaluated sequence data for playbook candidate discovery. Load 60D history to populate patterns.',
        observations: ['Requires ≥10 samples per sequence', 'Expectancy must exceed +0.35R'],
        provider: 'deterministic',
        fallbackUsed: true
      };
    }

    observations.push(
      `Strongest candidate: ${top.name} (+${top.expectancyR.toFixed(2)}R, n=${top.sampleCount}, ${top.confidence})`
    );

    for (const c of candidates.slice(1, 4)) {
      observations.push(
        `${c.name}: +${c.expectancyR.toFixed(2)}R · WR ${c.winRate}% · ${c.uniqueSymbols} symbols`
      );
    }

    for (const c of candidates.filter(x => x.sequence.some(s => s.contextTags.includes('AFTER_FAILED_BREAKOUT') || s.contextTags.includes('RECLAIM_AFTER_BO'))).slice(0, 2)) {
      observations.push(
        `Reclaim continuation after failed opening expansion shows +${c.expectancyR.toFixed(2)}R in ${c.regimes.join('/')} environments`
      );
    }

    for (const r of relationships.slice(0, 3)) {
      observations.push(r.message);
    }

    const weakening = candidates.filter(c => c.evolutionState === 'WEAKENING');
    if (weakening.length) {
      observations.push(`${weakening.length} candidate(s) weakening — review before promotion`);
    }

    const summary = [
      `${candidates.length} qualified playbook candidate(s) discovered from evaluated signals.`,
      top.regimes.length ? `Best edge in ${top.regimes.slice(0, 2).join(' and ')} regimes.` : '',
      top.bestTimeWindows.length ? `Peak window: ${top.bestTimeWindows[0]}.` : '',
      'Human review required before any promotion — no auto-enablement.'
    ].filter(Boolean).join(' ');

    return { summary, observations, provider: 'deterministic', fallbackUsed: true };
  }
}
