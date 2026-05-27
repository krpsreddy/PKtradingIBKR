import { AssistedPositionView } from '../assisted-exit-intelligence/assisted-exit.models';
import { PaperExecutionRecord } from '../../models/paper-execution.model';
import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';
import {
  ALL_SHADOW_EXIT_MODELS,
  ShadowExitModelId,
  ShadowExitPath,
  ShadowTradeContext
} from './shadow-exit.models';
import { simulatePersistenceTrail } from './persistence-trailing.engine';
import { simulateAdaptiveTrail } from './adaptive-trailing.engine';
import { simulateSecondLegHold } from './second-leg-hold.engine';

export function toShadowContext(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null
): ShadowTradeContext {
  return {
    tradeId: record.id,
    symbol: record.symbol,
    regime: record.regime,
    entryR: 0,
    currentMfeR: record.mfeR ?? 0,
    currentMaeR: record.maeR ?? 0,
    mfeR: record.mfeR ?? 0,
    realizedR: record.realizedR,
    closed: record.status === 'CLOSED',
    conviction: feed?.conviction ?? record.convictionScore ?? 50,
    dominance: feed?.triggerIntegrity ? feed.triggerIntegrity * 100 : record.dominanceScore ?? 50,
    persistenceSec: feed?.persistenceSeconds ?? record.persistenceDurationSec ?? 0,
    expansionProb: feed?.expansionProbability ?? 0.5,
    maturityState: feed?.maturityState ?? 'CONFIRMED'
  };
}

export function runShadowModel(modelId: ShadowExitModelId, ctx: ShadowTradeContext): ShadowExitPath {
  const { exitR, reason } = simulateModel(modelId, ctx);
  const mfe = ctx.mfeR;
  const mfeRetained = mfe > 0 ? Math.min(100, Math.max(0, (exitR / mfe) * 100)) : 0;
  const postExit = ctx.closed && ctx.realizedR != null
    ? Math.max(0, (ctx.mfeR - (ctx.realizedR ?? 0)) * 0.5)
    : Math.max(0, mfe - exitR) * 0.35;
  const contEff = mfe > 0 ? clamp((exitR / mfe) * 100 * (ctx.expansionProb + 0.3), 0, 100) : 0;

  return {
    modelId,
    tradeId: ctx.tradeId,
    symbol: ctx.symbol,
    regime: ctx.regime,
    simulatedExitR: exitR,
    exitReason: reason,
    mfeAtExit: mfe,
    mfeRetainedPct: mfeRetained,
    maeExperienced: ctx.currentMaeR,
    continuationSurvivalAfterExit: exitR > 0 && postExit > 0.003,
    postExitExpansionR: postExit,
    trimQuality: clamp(50 + exitR * 200, 0, 100),
    exhaustionQuality: ctx.maturityState === 'EXHAUSTING' ? 70 : 40,
    continuationMonetizationEfficiency: contEff,
    simulatedAt: Date.now()
  };
}

export function runAllShadowModels(
  record: PaperExecutionRecord,
  feed: ExecutionFeedItem | null
): ShadowExitPath[] {
  const ctx = toShadowContext(record, feed);
  return ALL_SHADOW_EXIT_MODELS.map(id => runShadowModel(id, ctx));
}

export function runShadowForAssisted(view: AssistedPositionView): ShadowExitPath[] {
  return runAllShadowModels(view.record, view.feed);
}

function simulateModel(
  modelId: ShadowExitModelId,
  ctx: ShadowTradeContext
): { exitR: number; reason: string } {
  switch (modelId) {
    case 'LEGACY_RR': {
      const target = 0.012;
      const stop = -0.008;
      if (ctx.mfeR >= target) return { exitR: target, reason: 'LEGACY_TARGET' };
      if (ctx.currentMaeR <= stop) return { exitR: stop, reason: 'LEGACY_STOP' };
      return { exitR: ctx.currentMfeR * 0.5, reason: 'LEGACY_OPEN' };
    }
    case 'AUTONOMOUS_TEMPLATE': {
      const t = ctx.expansionProb > 0.5 ? 0.018 : 0.01;
      return { exitR: Math.min(ctx.mfeR, t), reason: 'TEMPLATE_TARGET' };
    }
    case 'PERSISTENCE_TRAIL':
      return simulatePersistenceTrail(ctx);
    case 'SECOND_LEG_HOLD':
      return simulateSecondLegHold(ctx);
    case 'VWAP_PERSISTENCE_EXIT': {
      if (/VWAP/i.test(ctx.regime) && ctx.dominance < 45) {
        return { exitR: ctx.currentMaeR, reason: 'VWAP_FAIL' };
      }
      return simulatePersistenceTrail(ctx);
    }
    case 'EARLY_EXHAUSTION_EXIT': {
      if (ctx.maturityState === 'EXHAUSTING') {
        return { exitR: Math.max(ctx.mfeR * 0.35, ctx.currentMaeR), reason: 'EARLY_EXH' };
      }
      return { exitR: ctx.mfeR * 0.6, reason: 'HOLD_EXH' };
    }
    case 'ADAPTIVE_TRAIL':
    default:
      return simulateAdaptiveTrail(ctx);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
