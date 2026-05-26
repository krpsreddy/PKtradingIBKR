import { ContextEmphasis } from '../models/execution.model';
import { MarketTrend } from '../models/workspace.model';

const MOMENTUM_BULL = new Set(['OPEN_MOM_BUY', 'OPEN_SCOUT', 'MOM_BUY', 'CONT_BUY', 'CONT_READY', 'OPEN_READY']);
const BEARISH = new Set(['OPEN_FAIL', 'OPEN_FAIL_BREAK', 'RECOVERY_FAIL', 'IMBALANCE_DOWN']);

export function getContextEmphasis(signalType: string, marketTrend: MarketTrend | null): ContextEmphasis {
  const regime = marketTrend?.regime?.toUpperCase() ?? '';
  const choppy = marketTrend?.choppy || regime === 'CHOPPY';
  const bull = regime.includes('BULL') || regime === 'RISK_ON';
  const bear = regime.includes('BEAR') || regime === 'RISK_OFF';

  if (choppy && MOMENTUM_BULL.has(signalType)) {
    return { glowMultiplier: 0.55, rankBoost: -12, deemphasize: true, cssClass: 'ctx-chop-dim' };
  }

  if (bull && MOMENTUM_BULL.has(signalType)) {
    return { glowMultiplier: 1.2, rankBoost: 10, deemphasize: false, cssClass: 'ctx-bull-boost' };
  }

  if (bear && BEARISH.has(signalType)) {
    return { glowMultiplier: 1.15, rankBoost: 8, deemphasize: false, cssClass: 'ctx-bear-boost' };
  }

  if (bear && MOMENTUM_BULL.has(signalType)) {
    return { glowMultiplier: 0.7, rankBoost: -6, deemphasize: true, cssClass: 'ctx-bear-dim' };
  }

  return { glowMultiplier: 1, rankBoost: 0, deemphasize: false, cssClass: '' };
}

export function signalAccentClass(signalType: string): string {
  if (signalType === 'OPEN_MOM_BUY' || signalType === 'OPEN_SCOUT') return 'accent-open-mom';
  if (signalType === 'OPEN_FAIL' || signalType === 'OPEN_FAIL_BREAK' || signalType === 'RECOVERY_FAIL') return 'accent-open-fail';
  if (signalType === 'CONT_BUY' || signalType === 'CONT_READY') return 'accent-cont';
  if (signalType === 'EXTENDED_BULL' || signalType === 'EXTENDED_BEAR') return 'accent-extended';
  if (signalType === 'MOM_BUY') return 'accent-mom';
  if (signalType === 'IMBALANCE_DOWN') return 'accent-fail';
  return 'accent-neutral';
}
