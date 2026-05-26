import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { InstitutionalLabel } from './dominant-opportunity.models';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/** Institutional participation score (0–100). */
export function institutionalPressureScore(card: ScannerOpportunityCard): number {
  const base = card.institutionalPressure ?? 0;
  const rvolBoost = card.rvolLabel?.toLowerCase().includes('high') ? 12 : 0;
  const typeBoost = card.opportunityType === 'INSTITUTIONAL_ACCELERATION' ? 18 : 0;
  const execution = (card.executionQuality ?? 0) * 0.15;
  return clamp(Math.round(base * 0.75 + rvolBoost + typeBoost + execution));
}

export function institutionalLabel(score: number): InstitutionalLabel {
  if (score >= 68) return 'HIGH';
  if (score >= 42) return 'MEDIUM';
  return 'LOW';
}
