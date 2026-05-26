import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from '../signal-intelligence.math';
import {
  ExecutionEntryClassification,
  ExecutionMissedWinnerReport,
  ExecutionMissedWinnerRow,
  SuppressionSafetyRating
} from './execution-quality.models';
import { ExecutionEntryClassificationEngine } from './execution-entry-classification.engine';
import { MIN_AUTHORITATIVE_SAMPLE, meetsMultiValidation } from './execution-quality.util';

const TOXIC: ExecutionEntryClassification[] = [
  'CHASE', 'EXHAUSTED', 'TRAP_RISK', 'LIQUIDITY_SWEEP_RISK', 'EXTENDED'
];

/** Analyze false suppressions and over-aggressive classification filters. */
export class ExecutionMissedWinnerAnalysisEngine {
  private readonly classifier = new ExecutionEntryClassificationEngine();

  analyze(signals: SignalSnapshot[]): ExecutionMissedWinnerReport {
    const evaluated = evaluatedSignals(signals);
    const multiValid = meetsMultiValidation(evaluated);
    const rows: ExecutionMissedWinnerRow[] = [];

    for (const classification of TOXIC) {
      const wouldSuppress = evaluated.filter(s =>
        this.classifier.classify(s, evaluated.length).classification === classification
      );
      if (wouldSuppress.length < 3) continue;

      const winners = wouldSuppress.filter(s => s.evaluation!.status === 'WIN');
      const highCont = winners.filter(s => (s.evaluation!.mfeR ?? 0) >= 1);
      const missedExp = winners.length ? computeExpectancyR(winners) : 0;
      const winnerRatio = pct(winners.length, wouldSuppress.length);
      const regretScore = Math.round(
        Math.max(0, missedExp * 20 + highCont.length * 3 + winnerRatio * 0.4)
      );

      const safetyRating = this.safetyRating(wouldSuppress.length, winners.length, missedExp, multiValid);

      rows.push({
        classification,
        suppressedCount: wouldSuppress.length,
        missedWinners: winners.length,
        missedExpectancyR: Math.round(missedExp * 100) / 100,
        missedContinuationPct: pct(highCont.length, Math.max(1, wouldSuppress.length)),
        regretScore,
        safetyRating,
        note: this.note(classification, winners.length, missedExp, safetyRating)
      });
    }

    rows.sort((a, b) => b.regretScore - a.regretScore);
    const totalRegret = rows.reduce((a, r) => a + r.regretScore, 0);

    return {
      rows: rows.slice(0, 8),
      totalRegretScore: totalRegret,
      overSuppressionSeverity: totalRegret >= 80 ? 'HIGH' : totalRegret >= 40 ? 'MEDIUM' : 'LOW',
      advisoryOnly: true
    };
  }

  private safetyRating(n: number, winners: number, missedExp: number, multiValid: boolean): SuppressionSafetyRating {
    if (n < MIN_AUTHORITATIVE_SAMPLE || !multiValid) return 'INSUFFICIENT_DATA';
    const winnerRatio = winners / n;
    if (winnerRatio >= 0.35 && missedExp > 0.2) return 'RISKY';
    if (winnerRatio >= 0.22 && missedExp > 0.1) return 'CAUTION';
    return 'SAFE';
  }

  private note(
    classification: ExecutionEntryClassification,
    winners: number,
    missedExp: number,
    safety: SuppressionSafetyRating
  ): string {
    const label = classification.replace(/_/g, ' ');
    if (safety === 'INSUFFICIENT_DATA') return `${label} filter needs more multi-session validation`;
    if (safety === 'RISKY') return `${label} would remove ${winners} winners (+${missedExp.toFixed(2)}R) — over-suppression risk`;
    if (safety === 'CAUTION') return `${label} removes some winners — review before applying`;
    return `${label} suppression appears statistically safe`;
  }
}
