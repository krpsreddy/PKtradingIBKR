import {
  FalseBreakoutSnapshot,
  OpeningDriveSnapshot
} from '../../../models/signal-intelligence.model';
import { LiveExecutionContext, LiveFakeoutRiskLevel, OpenTypeSnapshot } from './live-execution.models';
import { breadthFromContext, extensionPctFromContext, normalizeRegime, normalizeSetup } from './live-execution-context.util';

/** Live fakeout risk from follow-through, volume, breadth, open structure. */
export class LiveFakeoutRiskEngine {

  evaluate(
    ctx: LiveExecutionContext,
    falseBreakout: FalseBreakoutSnapshot,
    openingDrive: OpeningDriveSnapshot,
    openType: OpenTypeSnapshot
  ): { level: LiveFakeoutRiskLevel; label: string; score: number } {
    let score = falseBreakout.fakeoutScore;

    const setup = normalizeSetup(ctx.signalType);
    const regime = normalizeRegime(ctx.marketRegime);
    const breadth = breadthFromContext(ctx);
    const ext = extensionPctFromContext(ctx);
    const rvol = ctx.rvol ?? 1;

    if (setup === 'INSTITUTIONAL_ACCELERATION' && regime === 'CHOP') score += 18;
    if (breadth === 'WEAK') score += 12;
    if (openType.fakeBreakoutEnvironment) score += 15;
    if (openType.openType === 'TRAP_OPEN') score += 20;
    if (openingDrive.openingDriveType === 'HIGH_OPENING_TRAP_RISK') score += 14;
    if (ext >= 8 && setup === 'EARLY_CONTINUATION') score += 12;
    if (rvol >= 4 && ext >= 5 && regime === 'CHOP') score += 10;

    if (falseBreakout.trapRisk === 'LOW') score -= 8;
    if (openingDrive.continuationProbability > 60) score -= 10;
    if (breadth === 'STRONG' && regime === 'TREND') score -= 8;

    score = Math.round(Math.min(100, Math.max(0, score)));
    const level = classifyRisk(score);

    return { level, label: fakeoutLabel(level), score };
  }
}

function classifyRisk(score: number): LiveFakeoutRiskLevel {
  if (score >= 72) return 'EXTREME';
  if (score >= 52) return 'HIGH';
  if (score >= 32) return 'MODERATE';
  return 'LOW';
}

function fakeoutLabel(level: LiveFakeoutRiskLevel): string {
  switch (level) {
    case 'LOW': return 'LOW FAKEOUT RISK';
    case 'MODERATE': return 'MODERATE FAKEOUT';
    case 'HIGH': return 'HIGH FAKEOUT';
    case 'EXTREME': return 'EXTREME FAKEOUT';
  }
}

export function fakeoutMatrixStatus(level: LiveFakeoutRiskLevel): 'LOW' | 'NEUTRAL' | 'HIGH' | 'POOR' {
  switch (level) {
    case 'LOW': return 'LOW';
    case 'MODERATE': return 'NEUTRAL';
    case 'HIGH': return 'HIGH';
    case 'EXTREME': return 'POOR';
  }
}
