import { ExecutionPlan } from './execution-plan.models';

export function formatEntryZoneRange(plan: ExecutionPlan | null | undefined): string {
  if (!plan) return '—';
  const { low, high } = plan.entryZone;
  if (low === high) return `$${low.toFixed(2)}`;
  return `$${low.toFixed(2)}–$${high.toFixed(2)}`;
}

export function formatIdealEntry(plan: ExecutionPlan | null | undefined): string {
  if (!plan) return '—';
  const p = plan.entryZone.ideal ?? plan.entryZone.low;
  return `$${p.toFixed(2)}`;
}

export function formatStopPrice(plan: ExecutionPlan | null | undefined): string {
  if (!plan) return '—';
  return `$${plan.stopZone.price.toFixed(2)}`;
}

export function formatTargetPrice(plan: ExecutionPlan | null | undefined): string {
  if (!plan) return '—';
  const p = plan.targetZone.primary;
  return p != null ? `$${p.toFixed(2)}` : '—';
}

export function formatRiskReward(plan: ExecutionPlan | null | undefined): string {
  if (plan?.riskReward == null) return '—';
  return `${plan.riskReward}`;
}

export function formatSuggestedDirection(plan: ExecutionPlan | null | undefined): string {
  if (!plan) return '—';
  return plan.guidance.suggestedDirection
    ?? (plan.direction === 'LONG' ? 'CALLS' : 'PUTS');
}

export function syncScannerLabelsFromPlan(card: import('../autonomous-regime-scanner/autonomous-regime-scanner.models').ScannerOpportunityCard): void {
  if (!card.executionPlan) return;
  card.entryZoneLabel = formatEntryZoneRange(card.executionPlan);
}
