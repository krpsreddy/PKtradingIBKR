import { OpeningExpansionInput } from './opening-expansion.models';
import { isOpeningTrap } from './opening-expansion.util';

/** Detect institutional volume imbalance vs retail climax at the open. */
export class OpeningDriveImbalanceEngine {

  score(input: OpeningExpansionInput): number {
    if (isOpeningTrap(input.signalType)) return 0;
    let s = 0;
    const rvol = input.rvol ?? 0;
    const ext = Math.abs(input.vwapDistance ?? 0) * 100;
    const t = input.signalType.toUpperCase();

    if (t === 'IMBALANCE_UP') s += 28;
    if (t.includes('OPEN_MOM')) s += 22;
    if (t.includes('OPEN_SCOUT')) s += 14;
    if (rvol >= 2.5 && rvol <= 8) s += 20;
    if (rvol > 8 && ext > 4) s -= 18;
    if ((input.vwapDistance ?? 0) >= 0) s += 12;
    if (input.extended && ext > 5) s -= 22;
    if ((input.score ?? 0) >= 4) s += 10;

    return Math.max(0, Math.min(100, s));
  }

  isInstitutional(input: OpeningExpansionInput): boolean {
    return this.score(input) >= 55 && !this.isRetailExhaustion(input);
  }

  isRetailExhaustion(input: OpeningExpansionInput): boolean {
    const rvol = input.rvol ?? 0;
    const ext = Math.abs(input.vwapDistance ?? 0) * 100;
    if (isOpeningTrap(input.signalType)) return true;
    if (input.extended && rvol > 6 && ext > 4) return true;
    if (rvol > 10 && (input.score ?? 0) < 3) return true;
    if (input.signalType.includes('FAIL')) return true;
    return false;
  }
}
