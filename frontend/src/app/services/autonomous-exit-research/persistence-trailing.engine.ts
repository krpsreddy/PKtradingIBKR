import { ShadowTradeContext } from './shadow-exit.models';

/** Shadow exit: trail behind MFE with persistence gate. */
export function simulatePersistenceTrail(ctx: ShadowTradeContext): { exitR: number; reason: string } {
  const mfe = ctx.mfeR;
  if (mfe < 0.003) return { exitR: ctx.currentMaeR, reason: 'NO_EXPANSION' };
  const trail = mfe * 0.55;
  if (ctx.persistenceSec < 90 && ctx.expansionProb < 0.4) {
    return { exitR: Math.max(trail, ctx.currentMaeR), reason: 'PERSISTENCE_FAIL' };
  }
  if (ctx.maturityState === 'EXHAUSTING') {
    return { exitR: Math.max(trail * 0.9, mfe * 0.4), reason: 'EXHAUSTION_TRAIL' };
  }
  return { exitR: trail, reason: 'PERSISTENCE_TRAIL' };
}
