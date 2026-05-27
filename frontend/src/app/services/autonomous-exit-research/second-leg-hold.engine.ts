import { ShadowTradeContext } from './shadow-exit.models';

export function simulateSecondLegHold(ctx: ShadowTradeContext): { exitR: number; reason: string } {
  const mfe = ctx.mfeR;
  if (mfe < 0.006) return { exitR: ctx.currentMaeR, reason: 'NO_SECOND_LEG' };
  if (ctx.maturityState === 'EXTENDED' || ctx.expansionProb > 0.55) {
    return { exitR: mfe * 0.75, reason: 'SECOND_LEG_HOLD' };
  }
  return { exitR: mfe * 0.45, reason: 'LEG_FADE' };
}
