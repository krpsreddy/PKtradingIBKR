import {
  LifecycleCoachingInsight,
  ManagementAnalyticsSnapshot,
  OutcomeAttributionRow,
  TradeLifecycleIntelligenceSnapshot,
  TradeLifecycleSnapshot
} from './trade-lifecycle.models';
import { ManagementStyleExpectancy } from './trade-lifecycle.models';

/** Generate coaching insights from lifecycle intelligence — no auto-actions. */
export class TradeLifecycleCoachingEngine {

  generate(
    trades: TradeLifecycleSnapshot[],
    attributions: OutcomeAttributionRow[],
    management: ManagementAnalyticsSnapshot,
    styles: ManagementStyleExpectancy[],
    timing: TradeLifecycleIntelligenceSnapshot['expectancyByTiming']
  ): LifecycleCoachingInsight[] {
    const insights: LifecycleCoachingInsight[] = [];

    for (const t of trades.slice(0, 5)) {
      for (const note of t.lifecycleNotes) {
        insights.push({
          headline: note.toUpperCase(),
          detail: `${t.symbol} · ${t.path.signalType} · ${t.lifecycleState}`,
          severity: note.includes('premature') || note.includes('weakened') ? 'WARN' : 'INFO'
        });
      }
    }

    const lateTiming = timing.find(t => t.timing === 'LATE' || t.timing === 'CHASE');
    const idealTiming = timing.find(t => t.timing === 'IDEAL');
    if (lateTiming && idealTiming && lateTiming.expectancyR < idealTiming.expectancyR - 0.25 && lateTiming.n >= 5) {
      insights.push({
        headline: 'GOOD SIGNAL — LATE ENTRY REDUCED EXPECTANCY',
        detail: `Late/Chase ${lateTiming.expectancyR >= 0 ? '+' : ''}${lateTiming.expectancyR.toFixed(2)}R vs Ideal +${idealTiming.expectancyR.toFixed(2)}R`,
        severity: 'WARN'
      });
    }

    if (management.prematureExitRate >= 25) {
      insights.push({
        headline: 'EXIT WAS PREMATURE — REVIEW PARTIAL RULES',
        detail: `${management.prematureExitRate}% of trades gave back +1R+ before exit`,
        severity: 'WARN'
      });
    }

    if (management.heldThroughExhaustionRate >= 20) {
      insights.push({
        headline: 'CONTINUATION WEAKENED BEFORE EXIT',
        detail: `${management.heldThroughExhaustionRate}% held through exhaustion — tighten trailing`,
        severity: 'WARN'
      });
    }

    const breadthFails = attributions.filter(a => a.primaryFailure === 'WEAK_BREADTH_FAILURE');
    if (breadthFails.length >= 3) {
      insights.push({
        headline: 'BREAKOUT FAILED DUE TO WEAK BREADTH',
        detail: `${breadthFails.length} trades — wait for breadth confirmation`,
        severity: 'WARN'
      });
    }

    const bestStyle = styles[0];
    if (bestStyle && bestStyle.sampleCount >= 5 && bestStyle.expectancyR > 0.35) {
      insights.push({
        headline: `${bestStyle.style.replace(/_/g, ' ')} STYLE OUTPERFORMS`,
        detail: `+${bestStyle.expectancyR.toFixed(2)}R expectancy · n=${bestStyle.sampleCount}`,
        severity: 'POSITIVE'
      });
    }

    const execWins = attributions.filter(a => a.signalCorrect && a.executionFailed);
    if (execWins.length >= 2) {
      insights.push({
        headline: 'SIGNAL CORRECT — EXECUTION TIMING FAILED',
        detail: `${execWins.length} trades — idea worked, entry/manage did not`,
        severity: 'WARN'
      });
    }

    return dedupeInsights(insights).slice(0, 10);
  }

  coachFromTrade(trade: TradeLifecycleSnapshot | null): LifecycleCoachingInsight[] {
    if (!trade) return [];
    const insights: LifecycleCoachingInsight[] = trade.lifecycleNotes.map(note => ({
      headline: note.toUpperCase(),
      detail: `${trade.entryTiming} entry · ${trade.continuationHealth} continuation`,
      severity: note.includes('premature') || note.includes('failed') ? 'WARN' : 'INFO'
    }));
    if (trade.failureReason) {
      insights.unshift({
        headline: trade.failureReason.replace(/_/g, ' '),
        detail: `Attribution confidence ${trade.attributionConfidence}%`,
        severity: 'WARN'
      });
    }
    return insights.slice(0, 4);
  }
}

function dedupeInsights(items: LifecycleCoachingInsight[]): LifecycleCoachingInsight[] {
  const seen = new Set<string>();
  return items.filter(i => {
    if (seen.has(i.headline)) return false;
    seen.add(i.headline);
    return true;
  });
}
