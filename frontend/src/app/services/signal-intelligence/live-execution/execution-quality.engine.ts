import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { evaluatedSignals, pct } from '../signal-intelligence.math';
import {
  ChaseRiskLevel,
  EntryTimingQuality,
  ExecutionQualitySnapshot,
  LiveExecutionContext
} from './live-execution.models';
import { extensionPctFromContext } from './live-execution-context.util';

export interface ExecutionQualityInput {
  ctx: LiveExecutionContext;
  signalAgeMinutes?: number | null;
  extended?: boolean;
  symbolSignals?: SignalSnapshot[];
}

/** Differentiates signal failure vs execution failure — advisory only. */
export class ExecutionQualityEngine {

  evaluate(input: ExecutionQualityInput): ExecutionQualitySnapshot {
    const entryTiming = this.resolveEntryTiming(input);
    const chaseRisk = this.chaseRisk(input, entryTiming);
    const labels = this.buildLabels(entryTiming, chaseRisk, input);

    const historicalDiscipline = this.historicalDiscipline(input.symbolSignals ?? []);
    const entryQualityScore = this.entryQualityScore(entryTiming, chaseRisk, input);
    const exitEfficiency = this.exitEfficiency(input.symbolSignals ?? []);
    const managementQuality = Math.round((historicalDiscipline + exitEfficiency) / 2);
    const executionDiscipline = Math.round(
      entryQualityScore * 0.45 + managementQuality * 0.35 + (100 - chaseRiskScore(chaseRisk)) * 0.2
    );

    const signalVsExecution = this.classifyFailure(input.symbolSignals ?? [], entryTiming, chaseRisk);

    return {
      entryQualityScore,
      executionDiscipline,
      chaseRisk,
      entryTiming,
      exitEfficiency,
      managementQuality,
      signalVsExecution,
      labels,
      advisoryOnly: true
    };
  }

  private resolveEntryTiming(input: ExecutionQualityInput): EntryTimingQuality {
    const q = (input.ctx.entryQuality ?? '').toUpperCase();
    if (q.includes('CHASE')) return 'CHASE';
    if (q.includes('LATE')) return 'LATE';
    if (q.includes('EARLY')) return 'EARLY';
    if (q.includes('IDEAL') || q.includes('GOOD')) return 'IDEAL';

    const age = input.signalAgeMinutes ?? 0;
    if (input.extended || age > 12) return 'LATE';
    if (age > 6) return 'LATE';
    if (age <= 2) return 'EARLY';
    return 'IDEAL';
  }

  private chaseRisk(input: ExecutionQualityInput, timing: EntryTimingQuality): ChaseRiskLevel {
    const ext = extensionPctFromContext(input.ctx);
    if (timing === 'CHASE') return 'HIGH';
    if (timing === 'LATE' && ext >= 5) return 'HIGH';
    if (timing === 'LATE' || ext >= 8) return 'MEDIUM';
    if (input.extended) return 'MEDIUM';
    return 'LOW';
  }

  private entryQualityScore(timing: EntryTimingQuality, chase: ChaseRiskLevel, input: ExecutionQualityInput): number {
    let score = 70;
    switch (timing) {
      case 'IDEAL': score = 88; break;
      case 'EARLY': score = 72; break;
      case 'LATE': score = 48; break;
      case 'CHASE': score = 28; break;
    }
    if (chase === 'HIGH') score -= 18;
    if (chase === 'MEDIUM') score -= 8;
    if (extensionPctFromContext(input.ctx) >= 8) score -= 10;
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private historicalDiscipline(signals: SignalSnapshot[]): number {
    const entered = signals.filter(s => s.captureStage === 'ENTERED' || s.captureStage === 'TRIGGERED');
    if (!entered.length) return 55;
    const late = entered.filter(s => s.extendedEntry || s.captureStage === 'ENTERED' && (s.sessionTimeMinutes ?? 0) > 45);
    const chaseRate = pct(late.length, entered.length);
    return Math.round(Math.max(20, 100 - chaseRate * 0.8));
  }

  private exitEfficiency(signals: SignalSnapshot[]): number {
    const evaluated = evaluatedSignals(signals);
    if (!evaluated.length) return 50;
    const efficient = evaluated.filter(s => {
      const ev = s.evaluation!;
      if (ev.status === 'WIN') return (ev.mfeR ?? 0) >= 0.8;
      return (ev.maeR ?? 0) > -0.6;
    });
    return Math.round(pct(efficient.length, evaluated.length));
  }

  private classifyFailure(
    signals: SignalSnapshot[],
    timing: EntryTimingQuality,
    chase: ChaseRiskLevel
  ): ExecutionQualitySnapshot['signalVsExecution'] {
    const evaluated = evaluatedSignals(signals);
    if (!evaluated.length) return 'UNKNOWN';
    const losses = evaluated.filter(s => s.evaluation!.status === 'LOSS');
    if (!losses.length) return 'UNKNOWN';

    const lateLosses = losses.filter(s => s.extendedEntry || timing === 'LATE' || timing === 'CHASE');
    const lateLossRate = pct(lateLosses.length, losses.length);

    if (timing === 'CHASE' || chase === 'HIGH') return 'EXECUTION_ISSUE';
    if (lateLossRate >= 55) return 'EXECUTION_ISSUE';
    if (lateLossRate <= 25) return 'SIGNAL_ISSUE';
    return 'MIXED';
  }

  private buildLabels(timing: EntryTimingQuality, chase: ChaseRiskLevel, input: ExecutionQualityInput): string[] {
    const labels: string[] = [];
    if (timing === 'IDEAL') labels.push('IDEAL ENTRY');
    else if (timing === 'EARLY') labels.push('EARLY ENTRY');
    else if (timing === 'LATE') labels.push('LATE ENTRY');
    else labels.push('CHASE ENTRY');

    if (chase === 'HIGH') labels.push('CHASE RISK HIGH');
    else if (chase === 'MEDIUM') labels.push('CHASE RISK ELEVATED');

    if (extensionPctFromContext(input.ctx) >= 8) labels.push('OVEREXTENDED');
    return labels;
  }
}

function chaseRiskScore(risk: ChaseRiskLevel): number {
  switch (risk) {
    case 'LOW': return 15;
    case 'MEDIUM': return 45;
    case 'HIGH': return 75;
  }
}
