import { ScannerAlert, ScannerOpportunityCard } from './autonomous-regime-scanner.models';
import { SymbolScannerState } from './autonomous-regime-scanner.models';

const RISE_THRESHOLD = 8;
const CONVICTION_ALERT_MIN = 72;

export function detectRisingCards(
  cards: ScannerOpportunityCard[],
  states: Map<string, { popVelocity: number }>
): ScannerOpportunityCard[] {
  return cards.map(c => {
    const pop = states.get(c.symbol)?.popVelocity ?? c.popVelocity;
    return { ...c, popVelocity: pop, isRising: pop >= RISE_THRESHOLD };
  });
}

export function buildAlerts(cards: ScannerOpportunityCard[], states: Map<string, SymbolScannerState>): ScannerAlert[] {
  const alerts: ScannerAlert[] = [];
  const now = Date.now();
  for (const c of cards) {
    const st = states.get(c.symbol);
    if (!st || st.alertFired) continue;
    if (c.convictionScore >= CONVICTION_ALERT_MIN && st.popVelocity >= RISE_THRESHOLD) {
      alerts.push({
        symbol: c.symbol,
        message: `${c.symbol} conviction rising · ${c.badge.replace(/^[^\s]+\s/, '')}`,
        convictionDelta: st.popVelocity,
        at: now
      });
    }
  }
  return alerts.slice(0, 5);
}

export function markAlertFired(states: Map<string, SymbolScannerState>, symbol: string): void {
  const s = states.get(symbol.toUpperCase());
  if (s) s.alertFired = true;
}
