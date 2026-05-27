import { ShadowTradeContext } from './shadow-exit.models';

export function simulateAdaptiveTrail(ctx: ShadowTradeContext): { exitR: number; reason: string } {
  const mfe = ctx.mfeR;
  if (mfe <= 0) return { exitR: -0.008, reason: 'STRUCTURE_STOP' };
  const tighten = ctx.maturityState === 'EXHAUSTING' ? 0.35 : 0.5;
  const velFactor = ctx.conviction > 70 ? 0.62 : 0.48;
  const exitR = mfe * velFactor * (1 - tighten * 0.2);
  return { exitR: Math.max(exitR, ctx.currentMaeR), reason: 'ADAPTIVE_TRAIL' };
}
