import { DailyEdgeDiscoveryReport } from '../edge-discovery/edge-discovery.models';
import {
  ContinuationQualitySnapshot,
  DailyPlaybookPriority,
  DailyPlaybookPrioritySnapshot,
  EdgeTodaySnapshot,
  LiveExecutionContext,
  LiveFakeoutRiskLevel,
  OpenTypeSnapshot,
  PlaybookRecommendedSize
} from './live-execution.models';
import { breadthFromContext, normalizeRegime } from './live-execution-context.util';

/** Generates today's ranked playbook priorities — advisory only. */
export class DailyPlaybookPriorityEngine {

  evaluate(input: {
    ctx: LiveExecutionContext;
    edgeToday: EdgeTodaySnapshot;
    openType: OpenTypeSnapshot;
    continuation: ContinuationQualitySnapshot;
    fakeoutLevel: LiveFakeoutRiskLevel;
    report: DailyEdgeDiscoveryReport | null;
  }): DailyPlaybookPrioritySnapshot {
    const preferred: DailyPlaybookPriority[] = [];
    const avoid: DailyPlaybookPriority[] = [];
    let rank = 1;

    if (input.edgeToday.reclaimsWorking || input.openType.reclaimEnvironment) {
      preferred.push(this.item(rank++, 'VWAP RECLAIM', 78, 0.22, [
        'Reclaims working today',
        input.openType.openType === 'OPENING_FLUSH' ? 'Strong after opening flush' : 'Aligned open structure'
      ], 'FULL'));
    }

    if (input.openType.openType === 'OPENING_FLUSH') {
      preferred.push(this.item(rank++, 'OPENING FLUSH RECLAIM', 74, 0.18, [
        'Opening flush structure detected',
        'Historical reclaim edge after flush'
      ], 'REDUCED'));
    }

    if (input.edgeToday.continuationStrongAfter10 || input.continuation.level === 'STRONG') {
      preferred.push(this.item(rank++, 'POST-9:45 CONTINUATION', 70, 0.15, [
        'Continuation persistence elevated',
        'Favor confirmation after opening window'
      ], 'REDUCED'));
    }

    for (const insight of input.edgeToday.insights.filter(i => i.tone === 'WORKING' || i.tone === 'STRONG')) {
      if (preferred.length >= 3) break;
      if (preferred.some(p => p.playbook.includes(insight.setup.replace('_', ' ')))) continue;
      preferred.push(this.item(rank++, insight.setup.replace(/_/g, ' '), 65, insight.expectancyR, [
        insight.message
      ], insight.expectancyR > 0.15 ? 'FULL' : 'REDUCED'));
    }

    for (const c of input.report?.strongestConditions.slice(0, 2) ?? []) {
      if (preferred.length >= 3) break;
      if (preferred.some(p => p.playbook === c.label.toUpperCase())) continue;
      preferred.push(this.item(rank++, c.label.toUpperCase(), c.edgeScore, c.metrics.expectancyR, [
        `${c.metrics.sampleCount} samples · +${c.metrics.expectancyR.toFixed(2)}R`
      ], c.edgeScore >= 70 ? 'FULL' : 'REDUCED'));
    }

    while (preferred.length < 3) {
      const fillers = ['SELECTIVE TREND CONTINUATION', 'CONFIRMED VWAP RECLAIM', 'FIRST PULLBACK ENTRY'];
      const label = fillers[preferred.length];
      if (!preferred.some(p => p.playbook === label)) {
        preferred.push(this.item(preferred.length + 1, label, 52, 0.05, ['Default selective playbook'], 'SMALL'));
      } else break;
    }

    if (input.edgeToday.breakoutsWeak || (normalizeRegime(input.ctx.marketRegime) === 'CHOP')) {
      avoid.push(this.avoid(1, 'BREAKOUT CHASES', 82, -0.35, [
        'Breakouts weak today',
        'Chop regime suppresses breakout edge'
      ]));
    }

    if (input.edgeToday.momentumFailing || breadthFromContext(input.ctx) === 'WEAK') {
      avoid.push(this.avoid(avoid.length + 1, 'WEAK BREADTH MOMENTUM', 76, -0.28, [
        'Momentum failing without breadth',
        'Capital preservation priority'
      ]));
    }

    if (input.fakeoutLevel === 'HIGH' || input.fakeoutLevel === 'EXTREME' || input.edgeToday.openingFakeoutsElevated) {
      avoid.push(this.avoid(avoid.length + 1, 'OPENING FAKEOUT CHASES', 80, -0.4, [
        'Elevated opening fakeout frequency',
        'Wait for structure confirmation'
      ]));
    }

    for (const insight of input.edgeToday.insights.filter(i => i.tone === 'FAILING')) {
      if (avoid.length >= 3) break;
      avoid.push(this.avoid(avoid.length + 1, insight.setup.replace(/_/g, ' ') + ' CONTINUATION', 72, insight.expectancyR, [
        insight.message
      ]));
    }

    for (const t of input.report?.toxicConditions.slice(0, 2) ?? []) {
      if (avoid.length >= 3) break;
      avoid.push(this.avoid(avoid.length + 1, t.label.toUpperCase(), 85, t.metrics.expectancyR, [
        `Toxic cluster · ${t.metrics.fakeoutRate}% fakeout`
      ]));
    }

    return {
      preferred: preferred.slice(0, 3),
      avoid: avoid.slice(0, 3),
      advisoryOnly: true
    };
  }

  private item(
    rank: number,
    playbook: string,
    confidence: number,
    expectancy: number,
    reasoning: string[],
    recommendedSize: PlaybookRecommendedSize
  ): DailyPlaybookPriority {
    return { rank, playbook, confidence, expectancy, reasoning, recommendedSize };
  }

  private avoid(
    rank: number,
    playbook: string,
    confidence: number,
    expectancy: number,
    reasoning: string[]
  ): DailyPlaybookPriority {
    return { rank, playbook, confidence, expectancy, reasoning, recommendedSize: 'AVOID' };
  }
}
