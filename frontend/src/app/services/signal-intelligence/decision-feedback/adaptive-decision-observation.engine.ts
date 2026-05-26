import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { confidenceFromCount } from '../signal-intelligence.math';
import {
  AdaptiveDecisionObservation,
  ConvictionCalibrationReport,
  DecisionAccuracyStat,
  DecisionConsistencyReport,
  DecisionFeedbackReport,
  DecisionRegretReport,
  WaitVsActReport
} from './decision-feedback.models';
import { MIN_AUTHORITATIVE, MIN_LOW_CONFIDENCE } from './decision-feedback.util';

/** Generate deterministic advisory observations from decision feedback analytics. */
export class AdaptiveDecisionObservationEngine {
  observe(report: Omit<DecisionFeedbackReport, 'observations' | 'synthesis' | 'adaptiveInsightLine'>, n: number): AdaptiveDecisionObservation[] {
    const lines: AdaptiveDecisionObservation[] = [];
    const conf = confidenceFromCount(n);

    this.waitObservations(report.waitVsAct, n, lines);
    this.accuracyObservations(report.accuracy, n, lines);
    this.convictionObservations(report.convictionCalibration, n, lines);
    this.regretObservations(report.regret, n, lines);
    this.consistencyObservations(report.consistency, n, lines);
    this.reliabilityObservations(report.reliabilityScores, n, lines);

    return lines.slice(0, 10).map(l => ({ ...l, confidence: conf }));
  }

  private waitObservations(wait: WaitVsActReport, n: number, lines: AdaptiveDecisionObservation[]): void {
    if (n < MIN_AUTHORITATIVE) return;
    const best = wait.comparisons.find(c => c.expectancyImprovementR > 0.05);
    if (best) {
      lines.push({
        id: 'wait-exp',
        headline: `${best.strategy} improves momentum expectancy by +${best.expectancyImprovementR.toFixed(2)}R.`,
        detail: `Fakeout reduction ${best.fakeoutReductionPct.toFixed(0)}% · missed winner cost ~${best.missedWinnerCostR.toFixed(2)}R`,
        confidence: confidenceFromCount(best.sampleCount)
      });
    }
    const pullback = wait.comparisons.find(c => c.strategyId === 'WAIT_FOR_PULLBACK' && c.fakeoutReductionPct > 5);
    if (pullback) {
      lines.push({
        id: 'pullback-fakeout',
        headline: `Pullback waits reduce fakeouts by ${pullback.fakeoutReductionPct.toFixed(0)}%.`,
        detail: `Expectancy ${pullback.waitExpectancyR >= 0 ? '+' : ''}${pullback.waitExpectancyR.toFixed(2)}R vs instant ${pullback.instantExpectancyR.toFixed(2)}R`,
        confidence: confidenceFromCount(pullback.sampleCount)
      });
    }
  }

  private accuracyObservations(accuracy: DecisionAccuracyStat[], n: number, lines: AdaptiveDecisionObservation[]): void {
    if (n < MIN_LOW_CONFIDENCE) return;
    const full = accuracy.find(a => a.decision === 'FULL_EXECUTION');
    const weakBreadth = accuracy.filter(a => a.decision.includes('WAIT') && a.expectancyR > (full?.expectancyR ?? 0));
    if (full && full.expectancyR < 0 && full.sampleCount >= MIN_AUTHORITATIVE) {
      lines.push({
        id: 'full-under',
        headline: 'FULL_EXECUTION underperforms in current sample.',
        detail: `${full.expectancyR.toFixed(2)}R · WR ${full.winRate}% · n=${full.sampleCount}`,
        confidence: full.confidence
      });
    }
    const trap = accuracy.find(a => a.decision === 'TRAP_RISK' && a.sampleCount >= MIN_AUTHORITATIVE);
    if (trap && trap.correctAvoidanceRate !== undefined) {
      lines.push({
        id: 'trap-avoid',
        headline: `TRAP_RISK correctly avoided ${trap.correctAvoidanceRate.toFixed(0)}% of fakeouts.`,
        detail: `Fakeout rate ${trap.fakeoutRate}% on trap bucket · n=${trap.sampleCount}`,
        confidence: trap.confidence
      });
    }
    if (weakBreadth.length && full) {
      lines.push({
        id: 'wait-breadth',
        headline: 'WAIT decisions outperform aggressive execution in weak breadth continuation.',
        detail: `FULL ${full.expectancyR.toFixed(2)}R vs best WAIT ${weakBreadth[0].expectancyR.toFixed(2)}R`,
        confidence: confidenceFromCount(n)
      });
    }
  }

  private convictionObservations(cal: ConvictionCalibrationReport, n: number, lines: AdaptiveDecisionObservation[]): void {
    if (n < MIN_LOW_CONFIDENCE) return;
    const overstated = cal.points.filter(p => p.reliability === 'OVERSTATED' && p.sampleCount >= MIN_AUTHORITATIVE);
    for (const p of overstated.slice(0, 2)) {
      lines.push({
        id: `conv-over-${p.band}`,
        headline: `Conviction is overstated during ${p.band} band environments.`,
        detail: `${p.expectancyR.toFixed(2)}R actual vs expected tier · n=${p.sampleCount}`,
        confidence: p.confidence
      });
    }
    const elite = cal.points.find(p => p.band === 'ELITE' && p.sampleCount >= MIN_AUTHORITATIVE);
    const low = cal.points.find(p => p.band === 'LOW' && p.sampleCount >= MIN_AUTHORITATIVE);
    if (elite && low && elite.expectancyR > low.expectancyR + 0.5) {
      lines.push({
        id: 'conv-curve',
        headline: 'Conviction reliability curve aligns with outcomes.',
        detail: `ELITE ${elite.expectancyR.toFixed(2)}R · HIGH ${cal.points.find(p => p.band === 'HIGH')?.expectancyR.toFixed(2) ?? '—'}R · LOW ${low.expectancyR.toFixed(2)}R`,
        confidence: confidenceFromCount(n)
      });
    }
  }

  private regretObservations(regret: DecisionRegretReport, n: number, lines: AdaptiveDecisionObservation[]): void {
    if (n < MIN_AUTHORITATIVE) return;
    if (regret.falseAvoids >= 5) {
      lines.push({
        id: 'false-avoid',
        headline: `False avoids detected — ${regret.falseAvoids} winning signals suppressed.`,
        detail: 'Review AVOID governance in strong continuation zones',
        confidence: confidenceFromCount(n)
      });
    }
    if (regret.excessiveWaiting >= 10) {
      lines.push({
        id: 'excess-wait',
        headline: 'Decision engine may be too conservative on waiting.',
        detail: `${regret.excessiveWaiting} cases where wait missed expansion · regret score ${regret.regretScore}`,
        confidence: confidenceFromCount(n)
      });
    }
  }

  private consistencyObservations(consistency: DecisionConsistencyReport, n: number, lines: AdaptiveDecisionObservation[]): void {
    if (n < MIN_LOW_CONFIDENCE || !consistency.issues.length) return;
    const top = consistency.issues[0];
    lines.push({
      id: 'unstable-zone',
      headline: 'Unstable edge zone — inconsistent decisions in similar context.',
      detail: top.note,
      confidence: confidenceFromCount(top.sampleCount)
    });
  }

  private reliabilityObservations(
    scores: DecisionFeedbackReport['reliabilityScores'],
    n: number,
    lines: AdaptiveDecisionObservation[]
  ): void {
    if (n < MIN_LOW_CONFIDENCE) return;
    const best = [...scores].sort((a, b) => b.score - a.score)[0];
    const worst = [...scores].sort((a, b) => a.score - b.score)[0];
    if (best && best.score >= 60 && best.sampleCount >= MIN_AUTHORITATIVE) {
      lines.push({
        id: 'reliability-best',
        headline: `${best.label} has highest decision reliability (${best.score}/100).`,
        detail: `${best.expectancyR >= 0 ? '+' : ''}${best.expectancyR.toFixed(2)}R · fakeout avoidance ${best.fakeoutAvoidance}%`,
        confidence: best.confidence
      });
    }
    if (worst && worst.score < 45 && worst.sampleCount >= MIN_AUTHORITATIVE) {
      lines.push({
        id: 'reliability-weak',
        headline: `Decision engine weak on ${worst.label} (${worst.score}/100).`,
        detail: 'Review classification logic in this bucket — advisory only',
        confidence: worst.confidence
      });
    }
  }
}
