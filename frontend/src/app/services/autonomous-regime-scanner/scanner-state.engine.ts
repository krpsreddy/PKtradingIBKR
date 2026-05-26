import {
  AutonomousOpportunityType,
  AutonomousTraderAction,
  ScannerOpportunityCard
} from './autonomous-regime-scanner.models';

/** Phase 166 — live scanner state labels for autonomous execution shell. */
export type ScannerLiveState =
  | 'EARLY_EXPANSION'
  | 'PERSISTENT_CONTINUATION'
  | 'HEALTHY_PULLBACK'
  | 'VWAP_ACCEPTANCE'
  | 'COMPRESSION_READY'
  | 'LATE_EXTENSION'
  | 'EXHAUSTION_DRIFT'
  | 'REGIME_BREAKDOWN';

const STATE_LABELS: Record<ScannerLiveState, string> = {
  EARLY_EXPANSION: 'Early Expansion',
  PERSISTENT_CONTINUATION: 'Persistent Continuation',
  HEALTHY_PULLBACK: 'Healthy Pullback',
  VWAP_ACCEPTANCE: 'VWAP Acceptance',
  COMPRESSION_READY: 'Compression Ready',
  LATE_EXTENSION: 'Late Extension',
  EXHAUSTION_DRIFT: 'Exhaustion Drift',
  REGIME_BREAKDOWN: 'Regime Breakdown'
};

export function resolveScannerLiveState(card: ScannerOpportunityCard): ScannerLiveState {
  if (card.action === 'AVOID' || card.exhaustionProbability >= 60) {
    return card.exhaustionProbability >= 75 ? 'REGIME_BREAKDOWN' : 'EXHAUSTION_DRIFT';
  }
  switch (card.opportunityType) {
    case 'EARLY_CONTINUATION':
      return card.isRising ? 'EARLY_EXPANSION' : 'PERSISTENT_CONTINUATION';
    case 'SHALLOW_PULLBACK_CONTINUATION':
      return 'HEALTHY_PULLBACK';
    case 'VWAP_PERSISTENCE':
      return 'VWAP_ACCEPTANCE';
    case 'COMPRESSION_RELEASE':
      return 'COMPRESSION_READY';
    case 'TREND_RESUMPTION':
      return 'LATE_EXTENSION';
    case 'INSTITUTIONAL_ACCELERATION':
      return 'PERSISTENT_CONTINUATION';
    case 'LATE_STAGE_EXHAUSTION':
      return 'EXHAUSTION_DRIFT';
    default:
      return 'PERSISTENT_CONTINUATION';
  }
}

export function scannerLiveStateLabel(state: ScannerLiveState): string {
  return STATE_LABELS[state];
}

export function actionChipLabel(action: AutonomousTraderAction): string {
  return action;
}

export function isExhaustionState(state: ScannerLiveState): boolean {
  return state === 'EXHAUSTION_DRIFT' || state === 'REGIME_BREAKDOWN';
}

export function regimeGroupForType(type: AutonomousOpportunityType): string {
  switch (type) {
    case 'EARLY_CONTINUATION': return 'High Conviction Continuations';
    case 'INSTITUTIONAL_ACCELERATION': return 'Institutional Persistence';
    case 'SHALLOW_PULLBACK_CONTINUATION': return 'Healthy Shallow Pullbacks';
    case 'VWAP_PERSISTENCE': return 'VWAP Acceptance';
    case 'COMPRESSION_RELEASE': return 'Compression Breakouts';
    case 'TREND_RESUMPTION': return 'Trend Resumption';
    case 'LATE_STAGE_EXHAUSTION': return 'Exhaustion / Do Not Chase';
    default: return 'Early Expansion';
  }
}
