import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import {
  breadthBucket,
  entryQuality,
  timeWindow
} from '../edge-discovery/edge-cluster-metrics.util';
import { SimulationPresetId, SuppressionRuleDef } from './suppression-validation.models';
import { windowAt } from '../trade-lifecycle/trade-lifecycle.util';

const falseBreakout = new FalseBreakoutAnalyticsEngine();

/** Predefined toxic / dangerous entry filters for simulation. */
export const SUPPRESSION_RULES: SuppressionRuleDef[] = [
  {
    id: 'BREAKOUT_CHOP',
    label: 'BREAKOUT + CHOP',
    category: 'TOXIC',
    description: 'Breakouts in chop regime — high fakeout frequency',
    matches: s => s.signalType === 'BREAKOUT' && s.marketRegime === 'CHOP'
  },
  {
    id: 'BREAKOUT_HIGH_RVOL',
    label: 'BREAKOUT + RVOL > 5',
    category: 'TOXIC',
    description: 'Exhaustion breakouts on extreme relative volume',
    matches: s => s.signalType === 'BREAKOUT' && (s.rvol ?? 0) >= 5
  },
  {
    id: 'MOMENTUM_WEAK_BREADTH',
    label: 'MOMENTUM + WEAK BREADTH',
    category: 'TOXIC',
    description: 'Momentum without trend/breadth alignment',
    matches: s => s.signalType === 'MOMENTUM' && breadthBucket(s) === 'WEAK'
  },
  {
    id: 'CHASE_ENTRY',
    label: 'CHASE ENTRY',
    category: 'ENTRY',
    description: 'Extended chase entries — destroys expectancy',
    matches: s => entryQuality(s) === 'CHASE'
  },
  {
    id: 'LATE_ENTRY',
    label: 'LATE ENTRY',
    category: 'ENTRY',
    description: 'Late-stage entries after move extended',
    matches: s => entryQuality(s) === 'LATE'
  },
  {
    id: 'OPENING_MOMENTUM_WEAK',
    label: 'OPENING MOMENTUM + WEAK BREADTH',
    category: 'TOXIC',
    description: 'Opening-window momentum without breadth',
    matches: s =>
      s.signalType === 'MOMENTUM'
      && timeWindow(s.sessionTimeMinutes ?? 0) === '9:30–9:45'
      && breadthBucket(s) === 'WEAK'
  },
  {
    id: 'EXTENDED_5PCT',
    label: 'EXTENDED > 5%',
    category: 'ENTRY',
    description: 'Entries extended more than ~5% from VWAP/structure',
    matches: s => s.extendedEntry === true || Math.abs(s.vwapDistance ?? 0) > 0.05
  },
  {
    id: 'HIGH_FAKEOUT_RISK',
    label: 'HIGH FAKEOUT RISK',
    category: 'TOXIC',
    description: 'Signals matching false-breakout profile',
    matches: s => falseBreakout.isFalseBreakout(s) || (
      (s.signalType === 'BREAKOUT' || s.signalType === 'MOMENTUM')
      && (s.evaluation?.maeR ?? 0) < -0.45
      && !s.evaluation?.hit1R
    )
  },
  {
    id: 'LOW_RVOL_BREAKOUT',
    label: 'BREAKOUT + RVOL < 1.5',
    category: 'TOXIC',
    description: 'Low-participation breakouts',
    matches: s => s.signalType === 'BREAKOUT' && (s.rvol ?? 0) < 1.5
  },
  {
    id: 'TREND_CONT_CHOP',
    label: 'TREND CONTINUATION + CHOP',
    category: 'TOXIC',
    description: 'Continuation setups in chop — low follow-through',
    matches: s => s.signalType === 'TREND_CONTINUATION' && s.marketRegime === 'CHOP'
  }
];

/** Acceptance confirmation — keep signals meeting hold/confirm criteria. */
export const ACCEPTANCE_KEEP_RULES: SuppressionRuleDef[] = [
  {
    id: 'RECLAIM_HOLD',
    label: 'VWAP Reclaim Hold',
    category: 'ACCEPTANCE',
    description: 'VWAP reclaim with price holding above/below VWAP',
    matches: s =>
      s.signalType === 'VWAP_RECLAIM'
      && (s.vwapDistance ?? 0) >= -0.003
      && (windowAt(s.evaluation, 5)?.mfeR ?? s.evaluation?.mfeR ?? 0) >= 0.2
  },
  {
    id: 'SECOND_LEG_CONT',
    label: 'Second-Leg Continuation',
    category: 'ACCEPTANCE',
    description: 'Second candle continuation — 5m MFE confirms',
    matches: s => (windowAt(s.evaluation, 5)?.mfeR ?? 0) >= 0.35 && (windowAt(s.evaluation, 5)?.maeR ?? 0) > -0.35
  },
  {
    id: 'VWAP_ACCEPTANCE',
    label: 'VWAP Acceptance',
    category: 'ACCEPTANCE',
    description: 'Entry with constructive VWAP relationship',
    matches: s => Math.abs(s.vwapDistance ?? 0) <= 0.008 || (s.vwapDistance ?? 0) > 0
  },
  {
    id: 'PULLBACK_STABILITY',
    label: 'Pullback Stability',
    category: 'ACCEPTANCE',
    description: 'Shallow MAE — stable pullback before expansion',
    matches: s => (s.evaluation?.maeR ?? 0) > -0.45
  },
  {
    id: 'BREADTH_CONFIRMATION',
    label: 'Breadth Confirmation',
    category: 'ACCEPTANCE',
    description: 'Trend alignment ≥ 70 — breadth supports move',
    matches: s => (s.trendAlignment ?? 0) >= 70
  }
];

export const SIMULATION_PRESETS: { id: SimulationPresetId; label: string; description: string; ruleIds: string[] }[] = [
  {
    id: 'TOXIC_ENTRIES',
    label: 'Simulate Removing Toxic Entries',
    description: 'Remove all predefined toxic condition clusters',
    ruleIds: ['BREAKOUT_CHOP', 'BREAKOUT_HIGH_RVOL', 'MOMENTUM_WEAK_BREADTH', 'HIGH_FAKEOUT_RISK', 'OPENING_MOMENTUM_WEAK', 'TREND_CONT_CHOP']
  },
  {
    id: 'RECLAIM_CONFIRMATION',
    label: 'Simulate Reclaim Confirmation',
    description: 'Keep only VWAP reclaim + hold confirmed entries',
    ruleIds: ['RECLAIM_HOLD']
  },
  {
    id: 'ANTI_CHASE',
    label: 'Simulate Anti-Chase Rules',
    description: 'Remove chase, late, and extended entries',
    ruleIds: ['CHASE_ENTRY', 'LATE_ENTRY', 'EXTENDED_5PCT']
  },
  {
    id: 'DELAYED_CONTINUATION',
    label: 'Simulate Delayed Continuation Entries',
    description: 'Require second-leg / pullback / breadth confirmation',
    ruleIds: ['SECOND_LEG_CONT', 'PULLBACK_STABILITY', 'BREADTH_CONFIRMATION']
  }
];

export function ruleById(id: string): SuppressionRuleDef | undefined {
  return [...SUPPRESSION_RULES, ...ACCEPTANCE_KEEP_RULES].find(r => r.id === id);
}

export function applyCompositeSuppression(
  signals: SignalSnapshot[],
  ruleIds: string[],
  presetId?: SimulationPresetId
): SignalSnapshot[] {
  const preset = SIMULATION_PRESETS.find(p => p.id === presetId);
  const isAcceptance = preset?.id === 'RECLAIM_CONFIRMATION' || preset?.id === 'DELAYED_CONTINUATION';

  if (isAcceptance) {
    const keepRules = ruleIds.map(id => ruleById(id)).filter(Boolean) as SuppressionRuleDef[];
    if (!keepRules.length) return signals;
    const requireAll = presetId === 'DELAYED_CONTINUATION';
    return signals.filter(s =>
      requireAll ? keepRules.every(r => r.matches(s)) : keepRules.some(r => r.matches(s))
    );
  }

  const rules = ruleIds.map(id => ruleById(id)).filter(Boolean) as SuppressionRuleDef[];
  return signals.filter(s => !rules.some(r => r.matches(s)));
}
