/**
 * Phase 160 — legacy governance compatibility layer.
 * Handcrafted MOM/BREAKOUT/VWAP/SECOND LEG signals remain available for comparison analytics.
 * NOT deleted — deprecated as PRIMARY when ExecutionModeService is AUTONOMOUS_DISCOVERY.
 */
export { ContinuationPromotionSynthesisService as LegacyContinuationGovernanceService } from '../continuation-promotion/continuation-promotion-synthesis.service';
export { LiveDecisionEngine as LegacyLiveDecisionEngine } from '../live-decision/live-decision-engine';
export { ExecutionDecisionSynthesisService as LegacyExecutionDecisionService } from '../live-decision/execution-decision-synthesis.service';

export type LegacyGovernanceLabel =
  | 'MOM'
  | 'BREAKOUT'
  | 'VWAP_RECLAIM'
  | 'SECOND_LEG'
  | 'WAIT_FOR_PULLBACK'
  | 'WAIT_FOR_ACCEPTANCE'
  | 'AVOID_CHASE';

export const LEGACY_GOVERNANCE_SIGNALS: LegacyGovernanceLabel[] = [
  'MOM', 'BREAKOUT', 'VWAP_RECLAIM', 'SECOND_LEG',
  'WAIT_FOR_PULLBACK', 'WAIT_FOR_ACCEPTANCE', 'AVOID_CHASE'
];
