import { OptionsExecutionSnapshot } from '../models/probabilistic.model';

export interface OptionsExecutionLine {
  warnings: string[];
  strike: string;
  premium: string;
  compact: string;
}

export function formatOptionsExecution(o: OptionsExecutionSnapshot | null | undefined): OptionsExecutionLine | null {
  if (!o) return null;

  const warnings: string[] = [];
  const dir = (o.idealDirection ?? 'CALLS').includes('PUT') ? 'PUTS' : 'CALLS';

  if (o.thetaRisk === 'HIGH' || o.thetaRisk === 'EXTREME') {
    warnings.push(`AVOID LATE ${dir}`);
    warnings.push('FAST DECAY RISK');
  }

  const strikeType = o.recommendedStrikeType?.toUpperCase() ?? '';
  let strike = 'BEST WITH ATM';
  if (strikeType.includes('ITM')) strike = 'BEST WITH ATM / SLIGHT ITM';
  else if (strikeType.includes('AVOID') || strikeType.includes('OTM')) strike = 'AVOID FAR OTM';

  const prem = o.expectedPremiumExpansion ?? o.expectedPremiumDeterioration;
  let premium = '—';
  if (prem) {
    premium = prem.startsWith('-') ? prem : `+${prem.replace(/^\+/, '')}`;
    if (!premium.includes('%')) premium = `${premium}%`;
  }

  if (o.ivRisk === 'CRUSH_RISK') warnings.push('IV CRUSH RISK');
  if (o.capitalPreservation?.mode && o.capitalPreservation.mode !== 'CLEAR') {
    warnings.push('LOW OPTION EDGE');
  }

  const compact = [
    ...warnings.slice(0, 2),
    strike,
    premium !== '—' ? `EXP PREMIUM ${premium}` : null
  ].filter(Boolean).join(' · ');

  return { warnings, strike, premium, compact };
}
