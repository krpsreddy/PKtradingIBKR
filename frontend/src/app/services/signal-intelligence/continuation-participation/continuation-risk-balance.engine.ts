import { ContinuationParticipationInput } from './continuation-participation.models';
import { ExpansionParticipationEngine } from './expansion-participation-engine';
import { PullbackContinuationEngine } from './pullback-continuation-engine';
import { VwapAcceptanceContinuationEngine } from './vwap-acceptance-continuation.engine';
import { EarlyExpansionWindowEngine } from './early-expansion-window.engine';
import { ContinuationAddEngine } from './continuation-add-engine';

/** Block exhaustion / parabolic chase — no blind participation. */
export class ContinuationRiskBalanceEngine {

  isExhaustion(input: ContinuationParticipationInput): boolean {
    const vwap = Math.abs(input.vwapDistance ?? 0);
    const rvol = input.rvol ?? 0;
    const mins = input.sessionTimeMinutes ?? 0;
    if (input.extended && vwap > 0.04) return true;
    if (rvol > 12 && vwap > 0.035) return true;
    if (mins > 360 && rvol > 4 && vwap > 0.025) return true;
    return false;
  }

  balanceScore(input: ContinuationParticipationInput): number {
    if (this.isExhaustion(input)) return 0;
    const expansion = new ExpansionParticipationEngine();
    const pull = new PullbackContinuationEngine();
    const vwap = new VwapAcceptanceContinuationEngine();
    const early = new EarlyExpansionWindowEngine();
    const add = new ContinuationAddEngine();
    const raw = Math.max(
      expansion.score(input),
      pull.score(input),
      vwap.score(input),
      early.score(input),
      add.score(input)
    );
    if (input.extended) return Math.round(raw * 0.75);
    return raw;
  }
}
