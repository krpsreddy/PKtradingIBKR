import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { GeneralizationMetrics } from './robustness-validation.models';
import { avgR, round2, sessionDateFromTs, symbolConcentration, topSymbols, winRate } from './robustness-validation.util';

/** Symbol generalization — broad vs NVDA/AMD/QCOM-only bias. */
export class SymbolGeneralizationEngine {
  analyze(strategyName: string, signals: SignalSnapshot[]): GeneralizationMetrics {
    const symbols = new Set(signals.map(s => s.symbol));
    const sessions = new Set(signals.map(s => sessionDateFromTs(s.timestamp)));
    const conc = symbolConcentration(signals);

    const perSym = [...symbols].map(sym => {
      const bucket = signals.filter(s => s.symbol === sym);
      return winRate(bucket);
    });
    const meanWr = perSym.length ? perSym.reduce((a, b) => a + b, 0) / perSym.length : 0;
    const wrStd = perSym.length > 1
      ? Math.sqrt(perSym.reduce((n, w) => n + (w - meanWr) ** 2, 0) / perSym.length)
      : 0;

    const generalizes = symbols.size >= 3 && conc < 55 && wrStd < 25;

    return {
      strategyName,
      uniqueSymbols: symbols.size,
      uniqueSessions: sessions.size,
      symbolConcentrationPct: conc,
      crossSymbolWrStdDev: round2(wrStd),
      generalizes
    };
  }

  generalizationScore(signals: SignalSnapshot[]): number {
    const g = this.analyze('', signals);
    let score = 40;
    if (g.uniqueSymbols >= 5) score += 25;
    else if (g.uniqueSymbols >= 3) score += 15;
    if (g.symbolConcentrationPct < 40) score += 20;
    else if (g.symbolConcentrationPct < 55) score += 10;
    if (g.crossSymbolWrStdDev < 15) score += 15;
    return Math.min(100, score);
  }
}
