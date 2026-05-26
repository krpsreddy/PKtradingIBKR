import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ScannerOpportunityCard } from '../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { NanoScanResult } from '../real-time-execution/nano-scanner.engine';
import { regimeGroupForType } from '../autonomous-regime-scanner/scanner-state.engine';
import {
  ConvictionSample,
  DominantOpportunitySnapshot,
  DominantOpportunityState,
  DominantRecomputeInput,
  RankedDominantOpportunity
} from './dominant-opportunity.models';
import {
  computeAttentionPriorityScore,
  computeDominanceScore,
  marketLeadershipBoost
} from './dominance-score.engine';
import {
  continuationDominanceScore,
  persistenceTier
} from './continuation-dominance.engine';
import {
  institutionalLabel,
  institutionalPressureScore
} from './institutional-pressure.engine';
import { resolveMarketAttentionMode, marketModeWeights } from './market-attention.engine';
import {
  convictionDelta,
  isEmergingFast,
  recordConvictionSample
} from './emerging-opportunity.engine';

@Injectable({ providedIn: 'root' })
export class DominantOpportunityService {
  private readonly snapshotSubject = new BehaviorSubject<DominantOpportunitySnapshot | null>(null);
  readonly snapshot$ = this.snapshotSubject.asObservable();

  private readonly convictionHistory = new Map<string, ConvictionSample[]>();

  snapshot(): DominantOpportunitySnapshot | null {
    return this.snapshotSubject.value;
  }

  recompute(input: DominantRecomputeInput): DominantOpportunitySnapshot {
    const cards = dedupeCards(input.cards);
    const marketMode = resolveMarketAttentionMode(input.marketTrend);
    const weights = marketModeWeights(marketMode);
    const nanoBoosts = input.nanoBoosts ?? new Map<string, NanoScanResult>();
    const now = Date.now();

    const dominanceBySymbol = new Map<string, number>();
    const contexts: {
      card: ScannerOpportunityCard;
      nano?: NanoScanResult;
      delta: number;
      degrading: boolean;
      exhausting: boolean;
    }[] = [];

    for (const card of cards) {
      recordConvictionSample(this.convictionHistory, card.symbol, card.convictionScore, now);
      const nano = nanoBoosts.get(card.symbol);
      const delta = convictionDelta(card.symbol, card.convictionScore, this.convictionHistory, now);
      contexts.push({
        card,
        nano,
        delta,
        degrading: detectDegrading(card, delta),
        exhausting: card.exhaustionProbability >= 58 || card.action === 'AVOID'
      });
    }

    for (const ctx of contexts) {
      const score = computeDominanceScore({
        card: ctx.card,
        nano: ctx.nano,
        marketMode,
        convictionDelta: ctx.delta,
        degrading: ctx.degrading,
        exhausting: ctx.exhausting,
        marketLeaderBoost: 0
      });
      dominanceBySymbol.set(ctx.card.symbol, score);
    }

    const ranked: RankedDominantOpportunity[] = contexts.map(ctx =>
      this.buildRanked(ctx.card, {
        nano: ctx.nano,
        marketMode,
        convictionDelta: ctx.delta,
        degrading: ctx.degrading,
        exhausting: ctx.exhausting,
        marketLeaderBoost: marketLeadershipBoost(ctx.card.symbol, dominanceBySymbol),
        dominanceBySymbol
      })
    );

    ranked.sort((a, b) => b.attentionPriorityScore - a.attentionPriorityScore);
    applyAttentionSuppression(ranked);

    if (
      ranked.length &&
      ranked[0].state !== 'EXHAUSTING' &&
      ranked[0].state !== 'DEGRADING'
    ) {
      ranked[0].state = 'DOMINANT_NOW';
      if (!ranked[0].badges.includes('DOMINANT')) ranked[0].badges.unshift('DOMINANT');
    }

    const dominantCandidate = ranked.find(
      r => r.state === 'DOMINANT_NOW' && r.dominanceScore >= weights.dominanceFloor
    ) ?? ranked.find(r => r.dominanceScore >= weights.dominanceFloor && r.state !== 'EXHAUSTING') ?? null;

    const emergingFast =
      ranked.find(r => r.state === 'EMERGING_FAST' && r.card.symbol !== dominantCandidate?.card.symbol) ??
      ranked.filter(r => isEmergingFast(r.convictionDelta, r.card.popVelocity))[1] ??
      null;

    const topRanked = ranked
      .filter(r => r.state !== 'EXHAUSTING' && r.state !== 'DEGRADING')
      .slice(0, 5);

    const degrading = ranked.filter(r => r.state === 'DEGRADING' || r.state === 'EXHAUSTING').slice(0, 4);

    const snap: DominantOpportunitySnapshot = {
      computedAt: now,
      marketMode,
      marketLeader: dominantCandidate?.card.symbol ?? ranked[0]?.card.symbol ?? null,
      dominant: dominantCandidate,
      emergingFast: emergingFast && emergingFast.card.symbol !== dominantCandidate?.card.symbol
        ? emergingFast
        : ranked.find(r => r.state === 'EMERGING_FAST') ?? null,
      topRanked,
      degrading
    };

    this.snapshotSubject.next(snap);
    return snap;
  }

  suppressWeightForSymbol(symbol: string): number {
    const snap = this.snapshotSubject.value;
    if (!snap) return 0;
    const row = [...snap.topRanked, ...snap.degrading].find(r => r.card.symbol === symbol);
    return row?.suppressWeight ?? (snap.dominant?.card.symbol === symbol ? 0 : 0.35);
  }

  private buildRanked(
    card: ScannerOpportunityCard,
    ctx: {
      nano?: NanoScanResult;
      marketMode: import('./dominant-opportunity.models').MarketAttentionMode;
      convictionDelta: number;
      degrading: boolean;
      exhausting: boolean;
      marketLeaderBoost: number;
      dominanceBySymbol: Map<string, number>;
    }
  ): RankedDominantOpportunity {
    const dominanceScore = computeDominanceScore({
      card,
      nano: ctx.nano,
      marketMode: ctx.marketMode,
      convictionDelta: ctx.convictionDelta,
      degrading: ctx.degrading,
      exhausting: ctx.exhausting,
      marketLeaderBoost: ctx.marketLeaderBoost
    });
    ctx.dominanceBySymbol.set(card.symbol, dominanceScore);

    const contScore = continuationDominanceScore(card, ctx.nano);
    const instScore = institutionalPressureScore(card);
    const state = assignState(card, {
      dominanceScore,
      convictionDelta: ctx.convictionDelta,
      degrading: ctx.degrading,
      exhausting: ctx.exhausting,
      institutionalScore: instScore,
      continuationScore: contScore
    });

    const suppressWeight = 0;
    const attentionPriorityScore = computeAttentionPriorityScore(
      dominanceScore,
      ctx.convictionDelta,
      suppressWeight
    );

    return {
      card,
      dominanceScore,
      attentionPriorityScore,
      state,
      convictionDelta: ctx.convictionDelta,
      persistenceTier: persistenceTier(contScore),
      institutionalLabel: institutionalLabel(instScore),
      regimeLabel: regimeGroupForType(card.opportunityType).replace(/^High Conviction /, ''),
      whyNowLine: buildWhyNowLine(card, ctx.convictionDelta),
      velocityArrow: velocityArrow(ctx.convictionDelta, card.popVelocity),
      velocityDelta: ctx.convictionDelta,
      suppressWeight,
      badges: buildBadges(state, card)
    };
  }
}

function dedupeCards(cards: ScannerOpportunityCard[]): ScannerOpportunityCard[] {
  const bySym = new Map<string, ScannerOpportunityCard>();
  for (const c of cards) {
    const prev = bySym.get(c.symbol);
    if (!prev || c.convictionScore > prev.convictionScore) bySym.set(c.symbol, c);
  }
  return [...bySym.values()];
}

function detectDegrading(card: ScannerOpportunityCard, delta: number): boolean {
  if (card.exhaustionProbability >= 48 && card.popVelocity < 8) return true;
  if (delta <= -10) return true;
  if (card.action === 'EXIT') return true;
  return false;
}

function assignState(
  card: ScannerOpportunityCard,
  ctx: {
    dominanceScore: number;
    convictionDelta: number;
    degrading: boolean;
    exhausting: boolean;
    institutionalScore: number;
    continuationScore: number;
  }
): DominantOpportunityState {
  if (ctx.exhausting || card.action === 'AVOID') return 'EXHAUSTING';
  if (ctx.degrading) return 'DEGRADING';
  if (isEmergingFast(ctx.convictionDelta, card.popVelocity)) return 'EMERGING_FAST';
  if (ctx.institutionalScore >= 68 && card.opportunityType === 'INSTITUTIONAL_ACCELERATION') {
    return 'INSTITUTIONAL_FLOW';
  }
  if (ctx.continuationScore >= 72) return 'PERSISTENCE_LEADER';
  if (card.opportunityType === 'TREND_RESUMPTION' && card.expansionProbability >= 60) {
    return 'SECOND_LEG_DOMINANCE';
  }
  if (ctx.dominanceScore >= 62) return 'DOMINANT_NOW';
  if (card.action === 'WATCH') return 'WATCHLIST_READY';
  return 'WATCHLIST_READY';
}

function applyAttentionSuppression(ranked: RankedDominantOpportunity[]): void {
  if (!ranked.length) return;
  const top = ranked[0].dominanceScore;
  for (let i = 0; i < ranked.length; i++) {
    const gap = top - ranked[i].dominanceScore;
    const suppress = i === 0 ? 0 : Math.min(0.85, Math.max(0.15, gap / 55));
    ranked[i].suppressWeight = suppress;
    ranked[i].attentionPriorityScore = computeAttentionPriorityScore(
      ranked[i].dominanceScore,
      ranked[i].convictionDelta,
      suppress
    );
  }
  ranked.sort((a, b) => b.attentionPriorityScore - a.attentionPriorityScore);
}

function buildWhyNowLine(card: ScannerOpportunityCard, delta: number): string {
  const parts: string[] = [];
  if (delta >= 8) parts.push(`Conviction accelerating +${delta}`);
  if (card.rvolLabel) parts.push(card.rvolLabel);
  if (card.whyNow?.[0]) parts.push(card.whyNow[0]);
  else if (card.isRising) parts.push('Rising regime priority');
  return parts.slice(0, 2).join(' · ') || 'Monitoring continuation quality';
}

function velocityArrow(delta: number, pop: number): '↑' | '→' | '↓' | null {
  if (delta >= 6 || pop >= 18) return '↑';
  if (delta <= -8) return '↓';
  if (pop >= 8) return '→';
  return null;
}

function buildBadges(state: DominantOpportunityState, card: ScannerOpportunityCard): string[] {
  const badges: string[] = [];
  if (state === 'DOMINANT_NOW') badges.push('DOMINANT');
  if (state === 'EMERGING_FAST') badges.push('EMERGING');
  if (card.isRising) badges.push('RISING');
  if (card.institutionalPressure >= 65) badges.push('INST');
  return badges;
}
