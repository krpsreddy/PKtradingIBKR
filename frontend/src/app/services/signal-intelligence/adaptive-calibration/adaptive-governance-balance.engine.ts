import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import { GovernanceBalanceReport } from './adaptive-calibration.models';
import {
  contextFromSignal,
  isAvoidDecision,
  isFakeout,
  isWaitDecision,
  realizedR,
  round2
} from './adaptive-calibration.util';
import { LiveDecisionEngine } from '../live-decision/live-decision-engine';

/** Balance safety vs expansion participation. */
export class AdaptiveGovernanceBalanceEngine {
  private readonly decisionEngine = new LiveDecisionEngine();

  analyze(signals: SignalSnapshot[]): GovernanceBalanceReport {
    const evaluated = evaluatedSignals(signals);
    let falseAvoids = 0;
    let fakeoutsAvoided = 0;
    let missedExpansion = 0;
    let safeBlocks = 0;

    for (const s of evaluated) {
      const snap = this.decisionEngine.decide(contextFromSignal(s, evaluated.length));
      const won = s.evaluation!.status === 'WIN';
      const fake = isFakeout(s);
      const r = realizedR(s);

      if (isAvoidDecision(snap.decision) && won && r > 0.5) falseAvoids++;
      if (isAvoidDecision(snap.decision) && (fake || s.evaluation!.status === 'LOSS')) safeBlocks++;
      if (isWaitDecision(snap.decision) && won && r >= 1.2) missedExpansion++;
      if ((snap.decision === 'TRAP_RISK' || snap.decision === 'AVOID_TRADE') && fake) fakeoutsAvoided++;
    }

    const total = evaluated.length || 1;
    const falseAvoidRate = pct(falseAvoids, total);
    const fakeoutAvoidedRate = pct(fakeoutsAvoided, total);
    const missedExpansionRate = pct(missedExpansion, total);

    const safetyScore = round2(Math.min(100, fakeoutAvoidedRate * 1.2 + pct(safeBlocks, total) * 0.5));
    const expansionScore = round2(Math.max(0, 100 - missedExpansionRate - falseAvoidRate * 1.5));

    let balance: GovernanceBalanceReport['balance'] = 'BALANCED';
    if (falseAvoidRate > 15 && missedExpansionRate > 12) balance = 'TOO_CONSERVATIVE';
    else if (fakeoutAvoidedRate < 5 && falseAvoidRate < 5) balance = 'TOO_AGGRESSIVE';

    const targetNote = balance === 'TOO_CONSERVATIVE'
      ? 'Target: controlled aggression — reduce false avoids while preserving trap filters.'
      : balance === 'TOO_AGGRESSIVE'
        ? 'Target: restore safety filters — fakeout avoidance below historical baseline.'
        : 'Governance balance within calibrated range.';

    return {
      balance,
      safetyScore,
      expansionScore,
      falseAvoidRate,
      fakeoutAvoidedRate,
      missedExpansionRate,
      targetNote,
      advisoryOnly: true
    };
  }
}
