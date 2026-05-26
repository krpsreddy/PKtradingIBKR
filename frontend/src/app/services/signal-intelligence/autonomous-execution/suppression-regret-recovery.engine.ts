import { AutonomousDiscoveryReport } from '../autonomous-discovery/autonomous-discovery.models';

/** Quantify suppression regret recovery potential. */
export class SuppressionRegretRecoveryEngine {
  recoveryR(report: AutonomousDiscoveryReport | null, cluster: string | null): number | null {
    if (!report || !cluster) return null;
    const g = report.governanceSuppressedPatterns.find(p => p.strategyName === cluster);
    return g?.avgMissedR ?? null;
  }

  shouldRecover(original: string, score: number, regret: number | null): boolean {
    if (!original.includes('WAIT') && !original.includes('AVOID')) return false;
    if (score >= 65) return true;
    return regret != null && regret >= 1.5 && score >= 52;
  }
}
