import { SymbolScannerState } from './autonomous-regime-scanner.models';

const STATE_TTL_MS = 120_000;

export class ScannerSymbolStateEngine {
  private readonly states = new Map<string, SymbolScannerState>();

  update(symbol: string, conviction: number, now = Date.now()): SymbolScannerState {
    const sym = symbol.toUpperCase();
    const prev = this.states.get(sym);
    const lastConviction = prev?.lastConviction ?? conviction;
    const popVelocity = conviction - lastConviction;
    const next: SymbolScannerState = {
      symbol: sym,
      lastConviction: conviction,
      lastScanAt: now,
      popVelocity,
      alertFired: prev?.alertFired ?? false
    };
    this.states.set(sym, next);
    return next;
  }

  get(symbol: string): SymbolScannerState | null {
    const s = this.states.get(symbol.toUpperCase());
    if (!s || Date.now() - s.lastScanAt > STATE_TTL_MS) return null;
    return s;
  }

  clear(): void {
    this.states.clear();
  }
}
