import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Execution readiness — does not create entries; weights attention only. */
export function executionPriorityScore(card: ScannerOpportunityCard): number {
  const quality = card.executionQuality ?? 0;
  const trigger = card.triggerIntegrity ?? 0;
  const actionBoost =
    card.action === 'ENTER' ? 12 : card.action === 'ADD' ? 8 : card.action === 'WATCH' ? 2 : -15;
  const planBoost = card.executionPlan ? 6 : 0;
  return clamp(Math.round(quality * 0.45 + trigger * 0.35 + actionBoost + planBoost));
}
