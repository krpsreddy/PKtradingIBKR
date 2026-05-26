import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import {
  AmdCaseStudyDecomposition,
  RecommendedEntryProfile
} from './winner-decomposition.models';
import {
  AMD_CASE_STUDIES,
  AmdCaseStudySpec,
  classifyEntryLocation,
  confidenceTier,
  extractPreEntryEnvironment,
  matchesAmdCaseStudy,
  mfeR,
  preconditionsList,
  sessionDateFromTs
} from './winner-decomposition.util';
import { ExpansionWinnerQueryService } from './expansion-winner-query.service';

/** Build elite expansion winner profiles and AMD case study decompositions. */
export class EliteExpansionProfileEngine {

  buildRecommendedProfiles(signals: SignalSnapshot[], sampleCount: number): RecommendedEntryProfile[] {
    const templates = [
      { profile: 'Opening drive + VWAP hold + rising RVOL', loc: 'OPENING_DRIVE' as const, match: (s: SignalSnapshot) => classifyEntryLocation(s) === 'OPENING_DRIVE' && (s.rvol ?? 0) >= 2 },
      { profile: 'Second leg after shallow pullback', loc: 'SECOND_LEG' as const, match: (s: SignalSnapshot) => classifyEntryLocation(s) === 'SECOND_LEG' },
      { profile: 'Failed flush reclaim continuation', loc: 'VWAP_RECLAIM' as const, match: (s: SignalSnapshot) => classifyEntryLocation(s) === 'VWAP_RECLAIM' },
      { profile: 'Post-acceptance continuation hold', loc: 'POST_ACCEPTANCE_CONTINUATION' as const, match: (s: SignalSnapshot) => classifyEntryLocation(s) === 'POST_ACCEPTANCE_CONTINUATION' },
      { profile: 'Breakout hold with breadth', loc: 'BREAKOUT_HOLD' as const, match: (s: SignalSnapshot) => classifyEntryLocation(s) === 'BREAKOUT_HOLD' && (s.trendAlignment ?? 0) >= 60 }
    ];

    const out: RecommendedEntryProfile[] = [];
    for (const { profile, loc, match } of templates) {
      const rows = signals.filter(match);
      if (!rows.length) continue;
      const pre = extractPreEntryEnvironment(rows[0], sampleCount);
      out.push({
        profile,
        entryLocation: loc,
        triggerConditions: preconditionsList(pre),
        avgR: round2(rows.reduce((n, s) => n + mfeR(s), 0) / rows.length),
        sampleCount: rows.length,
        confidence: confidenceTier(rows.length)
      });
    }
    return out.sort((a, b) => b.avgR - a.avgR);
  }

  buildAmdCaseStudies(
    signals: SignalSnapshot[],
    sampleCount: number,
    query: ExpansionWinnerQueryService
  ): AmdCaseStudyDecomposition[] {
    return AMD_CASE_STUDIES.map(spec => this.decomposeCaseStudy(spec, signals, sampleCount, query));
  }

  private decomposeCaseStudy(
    spec: AmdCaseStudySpec,
    signals: SignalSnapshot[],
    sampleCount: number,
    query: ExpansionWinnerQueryService
  ): AmdCaseStudyDecomposition {
    const matched = signals.filter(s => matchesAmdCaseStudy(s, spec));
    const amdSignals = signals.filter(s => s.symbol === spec.symbol);
    const sessionDate = matched[0] ? sessionDateFromTs(matched[0].timestamp) : null;
    const sessionSignals = sessionDate
      ? amdSignals.filter(s => sessionDateFromTs(s.timestamp) === sessionDate)
      : amdSignals;

    const expansionWinners = matched.map(s => query.toExpansionWinner(s, sampleCount));
    const missed = sessionSignals
      .filter(s => {
        const pre = extractPreEntryEnvironment(s, sampleCount);
        return mfeR(s) >= 2 && pre.governance.suppressedWinner;
      })
      .slice(0, 5)
      .map(s => {
        const pre = extractPreEntryEnvironment(s, sampleCount);
        return {
          symbol: s.symbol,
          sessionDate: sessionDateFromTs(s.timestamp),
          timestamp: s.timestamp,
          decision: pre.governance.decision,
          suppressionReason: pre.governance.suppressionReasons.join('; ') || pre.governance.reason,
          outcomeR: mfeR(s),
          whatHappenedAfter: `Move continued +${mfeR(s).toFixed(1)}R after ${pre.governance.decision}`,
          shouldHaveBeen: 'FULL_EXECUTION at reclaim/second-leg acceptance',
          entryLocation: pre.entryLocation,
          narrative: pre.narrative.path,
          convictionBand: pre.governance.convictionBand
        };
      });

    const earliest = [...sessionSignals].sort((a, b) => a.timestamp - b.timestamp)[0];
    const reclaim = sessionSignals.find(s => classifyEntryLocation(s) === 'VWAP_RECLAIM' || classifyEntryLocation(s) === 'RECLAIM');
    const secondLeg = sessionSignals.find(s => classifyEntryLocation(s) === 'SECOND_LEG');

    const suppressionCause = missed[0]?.suppressionReason
      ?? (matched[0] ? extractPreEntryEnvironment(matched[0], sampleCount).governance.suppressionReasons.join('; ') : 'No matching session in evaluated history');

    return {
      id: spec.id,
      label: spec.label,
      symbol: spec.symbol,
      sessionDate,
      matched: matched.length > 0,
      moveDescription: spec.narrativeHint,
      earliestInstitutionalEntry: earliest ? extractPreEntryEnvironment(earliest, sampleCount) : null,
      idealReclaim: reclaim ? extractPreEntryEnvironment(reclaim, sampleCount) : null,
      secondLegTrigger: secondLeg ? extractPreEntryEnvironment(secondLeg, sampleCount) : null,
      governanceSuppressionCause: suppressionCause || 'Governance wait/avoid during pre-expansion setup',
      shouldHaveBeenFullExecution: reclaim
        ? 'FULL_EXECUTION on VWAP reclaim hold after first pullback'
        : 'FULL_EXECUTION on second-leg acceptance with rising RVOL',
      missedWinners: missed,
      expansionWinners
    };
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
