import { LiveExecutionDecision } from '../live-decision/live-decision.models';
import { AutonomousDiscoveryReport } from '../autonomous-discovery/autonomous-discovery.models';
import { ContinuationParticipationInput } from './continuation-participation.models';
import { isWaitOrSuppress } from './continuation-participation.util';

/** Relax governance when discovery stats show suppression regret. */
export class GovernanceSuppressionRelaxationEngine {

  regretR(report: AutonomousDiscoveryReport | null, matchedArchetype: string | null): number | null {
    if (!report || !matchedArchetype) return null;
    const gov = report.governanceSuppressedPatterns.find(g =>
      g.strategyName === matchedArchetype || g.strategyId.includes(matchedArchetype)
    );
    return gov?.avgMissedR ?? null;
  }

  shouldRelax(
    original: LiveExecutionDecision,
    participationScore: number,
    report: AutonomousDiscoveryReport | null,
    matchedArchetype: string | null
  ): boolean {
    if (!isWaitOrSuppress(original)) return false;
    if (participationScore < 55) return false;
    const regret = this.regretR(report, matchedArchetype);
    if (regret != null && regret >= 1.5) return true;
    const strat = report?.discoveredStrategies.find(s => s.name === matchedArchetype);
    if (strat && strat.promotable && strat.avgR >= 1.5) return true;
    return participationScore >= 68;
  }

  promotedDecision(original: LiveExecutionDecision, score: number): LiveExecutionDecision {
    if (score >= 72) return 'FULL_EXECUTION';
    if (score >= 55) return 'PROBING_EXECUTION';
    return original;
  }
}
