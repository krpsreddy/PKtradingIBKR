import { AutonomousOpportunityType } from '../services/autonomous-regime-scanner/autonomous-regime-scanner.models';
import { mapToOpportunityType } from '../services/autonomous-regime-scanner/scanner-ranking.engine';
import type { SignalSnapshot } from '../models/signal-intelligence.model';

/** Phase 168 — autonomous execution intelligence display ontology. */
export type AutonomousRegimeType =
  | 'EARLY_EXPANSION'
  | 'PERSISTENT_CONTINUATION'
  | 'FAILED_EXPANSION'
  | 'VWAP_ACCEPTANCE'
  | 'SHALLOW_PULLBACK_CONTINUATION'
  | 'COMPRESSION_BREAKOUT'
  | 'ACCELERATION_INTEGRITY'
  | 'LATE_EXTENSION'
  | 'EXHAUSTION_DRIFT'
  | 'REGIME_TRANSITION';

const LEGACY_TO_REGIME: Record<string, AutonomousRegimeType> = {
  OPEN_MOM_BUY: 'EARLY_EXPANSION',
  OPEN_SCOUT: 'EARLY_EXPANSION',
  OPEN_READY: 'EARLY_EXPANSION',
  IMBALANCE_UP: 'EARLY_EXPANSION',
  MOM_BUY: 'PERSISTENT_CONTINUATION',
  CONT_BUY: 'PERSISTENT_CONTINUATION',
  CONT_READY: 'PERSISTENT_CONTINUATION',
  PULL_BUY: 'SHALLOW_PULLBACK_CONTINUATION',
  VWAP_RECLAIM: 'VWAP_ACCEPTANCE',
  OPEN_FAIL: 'FAILED_EXPANSION',
  OPEN_FAIL_BREAK: 'FAILED_EXPANSION',
  RECOVERY_FAIL: 'FAILED_EXPANSION',
  IMBALANCE_DOWN: 'FAILED_EXPANSION',
  OPEN_FAIL_READY: 'FAILED_EXPANSION',
  EXIT: 'EXHAUSTION_DRIFT'
};

const REGIME_LABELS: Record<AutonomousRegimeType, string> = {
  EARLY_EXPANSION: 'Early Expansion',
  PERSISTENT_CONTINUATION: 'Persistent Continuation',
  FAILED_EXPANSION: 'Failed Expansion',
  VWAP_ACCEPTANCE: 'VWAP Acceptance',
  SHALLOW_PULLBACK_CONTINUATION: 'Healthy Pullback Continuation',
  COMPRESSION_BREAKOUT: 'Compression Breakout',
  ACCELERATION_INTEGRITY: 'Acceleration Integrity',
  LATE_EXTENSION: 'Late Extension',
  EXHAUSTION_DRIFT: 'Exhaustion Drift',
  REGIME_TRANSITION: 'Regime Transition'
};

export function resolveAutonomousRegime(
  signalType?: string | null,
  narrative?: string | null
): AutonomousRegimeType {
  const raw = (narrative ?? signalType ?? '').toUpperCase();
  if (raw.includes('EARLY') && raw.includes('EXPANSION')) return 'EARLY_EXPANSION';
  if (raw.includes('SHALLOW') || raw.includes('PULLBACK')) return 'SHALLOW_PULLBACK_CONTINUATION';
  if (raw.includes('VWAP')) return 'VWAP_ACCEPTANCE';
  if (raw.includes('COMPRESSION')) return 'COMPRESSION_BREAKOUT';
  if (raw.includes('EXHAUSTION')) return 'EXHAUSTION_DRIFT';
  if (raw.includes('LATE') && raw.includes('EXTENSION')) return 'LATE_EXTENSION';
  if (raw.includes('INSTITUTIONAL') || raw.includes('PERSISTENCE')) return 'PERSISTENT_CONTINUATION';
  if (raw.includes('REGIME') && raw.includes('TRANSITION')) return 'REGIME_TRANSITION';
  if (raw.includes('ACCELERATION')) return 'ACCELERATION_INTEGRITY';
  const key = (signalType ?? '').toUpperCase();
  return LEGACY_TO_REGIME[key] ?? 'PERSISTENT_CONTINUATION';
}

export function formatAutonomousRegime(
  signalType?: string | null,
  narrative?: string | null
): string {
  return REGIME_LABELS[resolveAutonomousRegime(signalType, narrative)];
}

const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  EARLY_CONTINUATION: 'Early Continuation',
  SHALLOW_PULLBACK_CONTINUATION: 'Healthy Pullback Continuation',
  VWAP_PERSISTENCE: 'VWAP Persistence',
  INSTITUTIONAL_ACCELERATION: 'Institutional Acceleration',
  COMPRESSION_RELEASE: 'Compression Release',
  TREND_RESUMPTION: 'Trend Resumption',
  LATE_STAGE_EXHAUSTION: 'Late-Stage Exhaustion'
};

/** Canonical opportunity axes for Strategy Research heatmaps & clusters. */
export const AUTONOMOUS_OPPORTUNITY_TYPES: AutonomousOpportunityType[] = [
  'EARLY_CONTINUATION',
  'SHALLOW_PULLBACK_CONTINUATION',
  'VWAP_PERSISTENCE',
  'INSTITUTIONAL_ACCELERATION',
  'COMPRESSION_RELEASE',
  'TREND_RESUMPTION',
  'LATE_STAGE_EXHAUSTION'
];

const LEGACY_SETUP_TO_OPPORTUNITY: Record<string, AutonomousOpportunityType> = {
  BREAKOUT: 'INSTITUTIONAL_ACCELERATION',
  VWAP_RECLAIM: 'VWAP_PERSISTENCE',
  TREND_CONTINUATION: 'TREND_RESUMPTION',
  REVERSAL: 'LATE_STAGE_EXHAUSTION',
  MOMENTUM: 'EARLY_CONTINUATION'
};

/** Map legacy signalType / sourceSignalType / opportunity codes to autonomous opportunity type. */
export function resolveAutonomousOpportunityFromLabel(
  entryType?: string | null,
  action?: string | null,
  classification?: string | null
): AutonomousOpportunityType {
  const raw = (entryType ?? '').toUpperCase();
  if (AUTONOMOUS_OPPORTUNITY_TYPES.includes(raw as AutonomousOpportunityType)) {
    return raw as AutonomousOpportunityType;
  }
  if (LEGACY_SETUP_TO_OPPORTUNITY[raw]) return LEGACY_SETUP_TO_OPPORTUNITY[raw];
  return mapToOpportunityType(raw, action ?? '', classification ?? '');
}

export function resolveAutonomousOpportunityType(
  signal: Pick<SignalSnapshot, 'signalType' | 'sourceSignalType'>
): AutonomousOpportunityType {
  const src = (signal.sourceSignalType ?? signal.signalType ?? '').toUpperCase();
  return resolveAutonomousOpportunityFromLabel(src);
}

/** Display label for autonomous opportunity type codes (review / analytics). */
export function formatAutonomousOpportunityType(type?: string | null): string {
  if (!type) return '—';
  const key = type.toUpperCase();
  if (OPPORTUNITY_TYPE_LABELS[key]) return OPPORTUNITY_TYPE_LABELS[key];
  if (REGIME_LABELS[key as AutonomousRegimeType]) return REGIME_LABELS[key as AutonomousRegimeType];
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Unified label for legacy signalType or autonomous opportunity/decision strings. */
export function formatReviewLabel(value?: string | null): string {
  if (!value) return '—';
  const v = value.toUpperCase();
  if (OPPORTUNITY_TYPE_LABELS[v]) return OPPORTUNITY_TYPE_LABELS[v];
  if (['ENTER', 'WATCH', 'ADD', 'AVOID', 'EXIT'].includes(v)) return v;
  return formatAutonomousRegime(value, value);
}

export function formatAutonomousRegimeCode(
  signalType?: string | null,
  narrative?: string | null
): string {
  return resolveAutonomousRegime(signalType, narrative);
}

export function translateAutonomousMessage(message: string): string {
  return message
    .replace(/\bOPEN_MOM\b/gi, 'Early Expansion')
    .replace(/\bOPEN MOM\b/gi, 'Early Expansion')
    .replace(/\bOPEN_MOMENTUM\b/gi, 'Early Expansion')
    .replace(/\bOPEN MOMENTUM\b/gi, 'Early Expansion')
    .replace(/\bCONT\b/g, 'Persistent Continuation')
    .replace(/\bCONT_BUY\b/gi, 'Persistent Continuation')
    .replace(/\bOPEN_FAIL\b/gi, 'Failed Expansion')
    .replace(/\bOPEN FAIL\b/gi, 'Failed Expansion')
    .replace(/\bMOM_BUY\b/gi, 'Persistent Continuation')
    .replace(/\bMomentum setup\b/gi, 'Continuation setup')
    .replace(/\bMomentum signal\b/gi, 'Continuation integrity')
    .replace(/\bMomentum signal weakened\b/gi, 'Continuation integrity degraded')
    .replace(/\bSignal\b/g, 'Opportunity')
    .replace(/\bsignal\b/g, 'opportunity');
}

export function formatTrendLabel(trend: string | null | undefined): string {
  if (!trend) return 'Neutral';
  const t = trend.toLowerCase();
  if (t.includes('bull')) return 'Bullish Participation';
  if (t.includes('bear')) return 'Bearish Drift';
  return 'Neutral';
}

export function defaultSymbolPersonality(symbol: string): string {
  const map: Record<string, string> = {
    QCOM: 'Explosive continuation persistence',
    AMD: 'Shallow PB continuation leader',
    NVDA: 'Institutional VWAP acceptance',
    TSLA: 'Acceleration instability · volatility expansion',
    META: 'Compression breakout persistence',
    MRVL: 'Institutional persistence with shallow PB efficiency',
    NOW: 'Persistent continuation with participation sustainment',
    CAR: 'High participation expansion leader'
  };
  return map[symbol.toUpperCase()] ?? 'Autonomous execution personality — analyze for persistence & expansion profile';
}
