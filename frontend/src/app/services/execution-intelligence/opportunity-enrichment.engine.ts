import { convictionCalibrationEngine } from '../conviction-calibration/conviction-calibration.engine';
import { deriveDominantAction } from '../action-dominance/action-dominance.engine';
import { buildLifecycleTimeline } from '../execution-lifecycle/execution-lifecycle.engine';
import {
  buildEnrichedOpportunity,
  compareEnriched,
  EnrichedOpportunity
} from './enriched-opportunity.model';
import { ExecutionFeedItem } from '../real-time-execution/real-time-execution.models';
import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';

/** Phase 169 — enriches feed/scanner items with calibration, actions, lifecycle. */
export function enrichFeedItems(items: ExecutionFeedItem[]): EnrichedOpportunity[] {
  const inputs = items.map(i => convictionCalibrationEngine.fromFeedItem(i));
  const calibrated = convictionCalibrationEngine.calibrateCohort(inputs);

  const enriched = items.map((item, idx) => {
    const cal = calibrated[idx];
    const action = deriveDominantAction({
      action: item.action,
      maturityState: item.maturityState,
      opportunityType: item.opportunityType,
      convictionScore: cal.convictionScore,
      urgencyScore: cal.urgencyScore,
      preConfirmation: item.preConfirmation
    });
    const lifecycle = buildLifecycleTimeline({
      maturityState: item.maturityState,
      opportunityType: item.opportunityType,
      persistenceSeconds: item.persistenceSeconds,
      convictionScore: cal.convictionScore,
      convictionVelocity: cal.convictionVelocity
    });
    return buildEnrichedOpportunity({ feedItem: item, calibration: cal, primaryAction: action, lifecycle });
  });

  return enriched.sort(compareEnriched).map((e, i) => ({ ...e, rank: i + 1 }));
}

export function enrichScannerCards(cards: ScannerOpportunityCard[]): EnrichedOpportunity[] {
  const inputs = cards.map(c => convictionCalibrationEngine.fromScannerCard(c));
  const calibrated = convictionCalibrationEngine.calibrateCohort(inputs);

  const enriched = cards.map((card, idx) => {
    const cal = calibrated[idx];
    const action = deriveDominantAction({
      action: card.action,
      opportunityType: card.opportunityType,
      convictionScore: cal.convictionScore,
      urgencyScore: cal.urgencyScore
    });
    const lifecycle = buildLifecycleTimeline({
      maturityState: card.opportunityType === 'LATE_STAGE_EXHAUSTION' ? 'EXHAUSTING' : 'CONFIRMED',
      opportunityType: card.opportunityType,
      convictionScore: cal.convictionScore,
      convictionVelocity: cal.convictionVelocity
    });
    return buildEnrichedOpportunity({ scannerCard: card, calibration: cal, primaryAction: action, lifecycle });
  });

  return enriched.sort(compareEnriched).map((e, i) => ({ ...e, rank: i + 1 }));
}

export function topEnrichedFromFeed(items: ExecutionFeedItem[]): EnrichedOpportunity | null {
  const enriched = enrichFeedItems(items);
  return enriched[0] ?? null;
}

export function topEnrichedFromScanner(cards: ScannerOpportunityCard[]): EnrichedOpportunity | null {
  const enriched = enrichScannerCards(cards);
  return enriched[0] ?? null;
}

/** Prefer nano feed #1; fallback to scanner snapshot top. */
export function resolveTopOpportunity(
  feed: ExecutionFeedItem[],
  scannerTop: ScannerOpportunityCard | null
): EnrichedOpportunity | null {
  const feedTop = topEnrichedFromFeed(feed);
  if (feedTop && feedTop.convictionScore >= 65) return feedTop;
  if (scannerTop) return topEnrichedFromScanner([scannerTop]);
  return feedTop;
}

/** Collapse weak opportunities below threshold for execution mode. */
export function visibleEnrichedFeed(
  items: ExecutionFeedItem[],
  mode: 'EXECUTION' | 'RESEARCH',
  executionFramework: 'EARLY' | 'CONFIRMED' = 'CONFIRMED'
): EnrichedOpportunity[] {
  let enriched = enrichFeedItems(items);
  if (executionFramework === 'EARLY') {
    enriched = enriched.filter(e => e.preConfirmation || e.executionMode === 'EARLY');
  } else {
    enriched = enriched.filter(e => !e.preConfirmation || e.convictionScore >= 65 || e.executionMode === 'CONFIRMED');
  }
  if (mode === 'EXECUTION') {
    enriched = enriched.filter(e => e.convictionScore >= 58 || e.isRising);
  }
  return enriched.slice(0, mode === 'EXECUTION' ? 16 : 24);
}
