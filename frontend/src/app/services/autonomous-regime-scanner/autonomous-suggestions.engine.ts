import { ScannerOpportunityCard } from './autonomous-regime-scanner.models';
import { formatAutonomousLabel } from './scanner-ranking.engine';

export function buildContinuationSuggestion(card: ScannerOpportunityCard): string {
  const label = formatAutonomousLabel(card.opportunityType);
  const lines = [
    `${card.symbol} ${label.toLowerCase()} remains valid:`,
    ...card.whyNow.map(w => `• ${w}`)
  ];
  if (card.exhaustionProbability < 45) {
    lines.push('• no exhaustion drift detected');
  }
  return lines.join('\n');
}

export function buildCompactSuggestion(card: ScannerOpportunityCard): string {
  const why = card.whyNow.slice(0, 2).join(' · ');
  return `${card.symbol} · ${card.badge.replace(/^[^\s]+\s/, '')} · ${why}`;
}

export function buildAvoidSuggestion(card: ScannerOpportunityCard): string {
  return `${card.symbol} — exhaustion developing (${card.exhaustionProbability}% risk). ${card.whyNow[0] ?? 'Stand aside.'}`;
}
