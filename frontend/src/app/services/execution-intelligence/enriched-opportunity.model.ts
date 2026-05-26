import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';
import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { CalibrationResult } from '../conviction-calibration/conviction-calibration.models';
import { DominantActionResult } from '../action-dominance/action-dominance.engine';
import { LifecycleTimeline } from '../execution-lifecycle/execution-lifecycle.engine';
import { ExecutionPlan } from '../execution-plan/execution-plan.models';
import { formatEntryZoneRange } from '../execution-plan/execution-plan-labels.util';

/** Phase 169 — unified enriched opportunity for cards, feed, and top scanner. */
export interface EnrichedOpportunity {
  symbol: string;
  source: 'feed' | 'scanner';
  opportunityType: string;
  tone: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  badge: string;
  convictionScore: number;
  urgencyScore: number;
  rarityScore: number;
  persistenceScore: number;
  confidenceStability: number;
  percentileRank: string;
  percentileLabel: string;
  scannerPriority: number;
  convictionVelocity: number;
  popVelocity: number;
  opportunityAge: number;
  primaryAction: DominantActionResult;
  lifecycle: LifecycleTimeline;
  whyNow: string[];
  entryZoneLabel: string;
  riskLabel: string;
  isRising: boolean;
  fadeExhaustion: boolean;
  rank: number;
  maturityState: string;
  executionMode?: string;
  preConfirmation?: boolean;
  executionPlan?: ExecutionPlan | null;
}

export interface EnrichedOpportunityInput {
  feedItem?: ExecutionFeedItem;
  scannerCard?: ScannerOpportunityCard;
  calibration: CalibrationResult;
  primaryAction: DominantActionResult;
  lifecycle: LifecycleTimeline;
}

export function buildEnrichedOpportunity(input: EnrichedOpportunityInput, rank = 0): EnrichedOpportunity {
  const feed = input.feedItem;
  const card = input.scannerCard;
  const cal = input.calibration;

  if (feed) {
    return {
      symbol: feed.symbol,
      source: 'feed',
      opportunityType: feed.opportunityType,
      tone: feed.tone,
      badge: feed.badge,
      convictionScore: cal.convictionScore,
      urgencyScore: cal.urgencyScore,
      rarityScore: cal.rarityScore,
      persistenceScore: cal.persistenceScore,
      confidenceStability: cal.confidenceStability,
      percentileRank: cal.percentileRank,
      percentileLabel: cal.percentileRank.replace(/_/g, ' '),
      scannerPriority: cal.scannerPriority,
      convictionVelocity: cal.convictionVelocity,
      popVelocity: cal.popVelocity,
      opportunityAge: cal.opportunityAge,
      primaryAction: input.primaryAction,
      lifecycle: input.lifecycle,
      whyNow: feed.whyNow,
      entryZoneLabel: feed.executionPlan ? formatEntryZoneRange(feed.executionPlan) : feed.entryZoneLabel,
      executionPlan: feed.executionPlan ?? null,
      riskLabel: feed.riskLabel,
      isRising: cal.convictionVelocity >= 8,
      fadeExhaustion: feed.maturityState === 'EXHAUSTING' || feed.action === 'AVOID',
      rank,
      maturityState: feed.maturityState,
      executionMode: feed.executionMode,
      preConfirmation: feed.preConfirmation
    };
  }

  return {
    symbol: card!.symbol,
    source: 'scanner',
    opportunityType: card!.opportunityType,
    tone: card!.tone,
    badge: card!.badge,
    convictionScore: cal.convictionScore,
    urgencyScore: cal.urgencyScore,
    rarityScore: cal.rarityScore,
    persistenceScore: cal.persistenceScore,
    confidenceStability: cal.confidenceStability,
    percentileRank: cal.percentileRank,
    percentileLabel: cal.percentileRank.replace(/_/g, ' '),
    scannerPriority: cal.scannerPriority,
    convictionVelocity: cal.convictionVelocity,
    popVelocity: cal.popVelocity,
    opportunityAge: cal.opportunityAge,
    primaryAction: input.primaryAction,
    lifecycle: input.lifecycle,
    whyNow: card!.whyNow,
    entryZoneLabel: card!.executionPlan ? formatEntryZoneRange(card!.executionPlan) : card!.entryZoneLabel,
    executionPlan: card!.executionPlan ?? null,
    riskLabel: card!.riskLabel,
    isRising: card!.isRising || cal.convictionVelocity >= 8,
    fadeExhaustion: card!.opportunityType === 'LATE_STAGE_EXHAUSTION',
    rank,
    maturityState: 'CONFIRMED',
    preConfirmation: false
  };
}

export function compareEnriched(a: EnrichedOpportunity, b: EnrichedOpportunity): number {
  if (b.scannerPriority !== a.scannerPriority) return b.scannerPriority - a.scannerPriority;
  return b.convictionScore - a.convictionScore;
}
