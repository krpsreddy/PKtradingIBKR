import { SetupCandidate } from '../models/execution.model';
import { ProbabilisticExecutionSnapshot } from '../models/probabilistic.model';

export interface ChartCognitionPill {
  label: string;
  tone: 'positive' | 'risk' | 'neutral';
}

export interface CognitionPillContext {
  nearTrigger: boolean;
  urgencyActive: boolean;
  exitNow: boolean;
  failureElevated: boolean;
  rvolSpike: boolean;
  breakoutActive: boolean;
}

export function selectChartCognitionPills(
  source: SetupCandidate | null,
  probabilistic: ProbabilisticExecutionSnapshot | null,
  nearTrigger: boolean,
  ctx?: Partial<CognitionPillContext>
): ChartCognitionPill[] {
  const urgency = ctx?.urgencyActive ?? false;
  if (!urgency && !ctx?.exitNow) {
    return [];
  }

  const pills: ChartCognitionPill[] = [];
  const rvol = source?.relativeVolume;
  if (ctx?.rvolSpike && rvol != null && rvol >= 2) {
    pills.push({ label: `RVOL ${rvol.toFixed(1)}x`, tone: 'positive' });
  }
  if (ctx?.breakoutActive || nearTrigger) pills.push({ label: 'Near trigger', tone: 'positive' });
  if (ctx?.exitNow) pills.push({ label: 'Exit risk', tone: 'risk' });
  if (probabilistic?.setupDna?.personality?.toLowerCase().includes('exhaustion')) {
    pills.push({ label: 'Weakening', tone: 'risk' });
  }
  if (ctx?.failureElevated) pills.push({ label: 'Failure elevated', tone: 'risk' });
  const theta = probabilistic?.optionsExecution?.thetaRisk;
  if (theta === 'HIGH' || theta === 'EXTREME') pills.push({ label: 'High theta', tone: 'risk' });
  if (source?.regimeAligned === false) pills.push({ label: 'Weak regime', tone: 'risk' });

  const priority = (p: ChartCognitionPill) => (p.tone === 'risk' ? 0 : p.tone === 'positive' ? 1 : 2);
  return pills.sort((a, b) => priority(a) - priority(b)).slice(0, 3);
}
