import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { confidenceFromCount } from '../signal-intelligence.math';
import {
  EntryClassificationResult,
  ExecutionEntryClassification,
  LiveExecutionQualityInput
} from './execution-quality.models';
import {
  computeFeatureScores,
  isChaseEntry,
  isEarlyProbe,
  isExhausted,
  isExtendedEntry,
  isIdealEntry,
  isLiquiditySweep,
  isReclaimConfirmed,
  isTrapRisk,
  MIN_AUTHORITATIVE_SAMPLE
} from './execution-quality.util';

/** Deterministic execution entry classification — one category per signal. */
export class ExecutionEntryClassificationEngine {

  classify(s: SignalSnapshot, historicalSampleCount = 0): EntryClassificationResult {
    const scores = computeFeatureScores(s);
    const classification = this.resolveCategory(s, scores);
    const confidence = confidenceFromCount(historicalSampleCount || (s.evaluation?.evaluated ? 1 : 0));
    const authoritative = historicalSampleCount >= MIN_AUTHORITATIVE_SAMPLE;

    return {
      classification,
      confidence,
      authoritative,
      scores,
      rationale: this.rationale(classification, scores),
      advisoryOnly: true
    };
  }

  classifyLive(input: LiveExecutionQualityInput, historicalSampleCount: number): EntryClassificationResult {
    return this.classify(this.buildLiveSnapshot(input), historicalSampleCount);
  }

  buildLiveSnapshot(input: LiveExecutionQualityInput): SignalSnapshot {
    return this.toSnapshot(input);
  }

  classifyMany(signals: SignalSnapshot[]): Map<string, EntryClassificationResult> {
    const map = new Map<string, EntryClassificationResult>();
    for (const s of signals) {
      map.set(s.id, this.classify(s, signals.length));
    }
    return map;
  }

  private resolveCategory(s: SignalSnapshot, scores: ReturnType<typeof computeFeatureScores>): ExecutionEntryClassification {
    if (isLiquiditySweep(s, scores)) return 'LIQUIDITY_SWEEP_RISK';
    if (isTrapRisk(s, scores)) return 'TRAP_RISK';
    if (isExhausted(s, scores)) return 'EXHAUSTED';
    if (isChaseEntry(s, scores)) return 'CHASE';
    if (isExtendedEntry(s, scores)) return 'EXTENDED';
    if (isReclaimConfirmed(s, scores)) return 'RECLAIM_CONFIRMED';
    if (isIdealEntry(s, scores)) return 'IDEAL';
    if (isEarlyProbe(s, scores)) return 'EARLY_PROBE';
    return 'ACCEPTABLE';
  }

  private rationale(classification: ExecutionEntryClassification, scores: ReturnType<typeof computeFeatureScores>): string[] {
    const lines: string[] = [`Classified as ${classification.replace(/_/g, ' ')}`];
    if (scores.extensionPct >= 5) lines.push(`Extension ${scores.extensionPct.toFixed(1)}%`);
    if (scores.fakeoutElevated) lines.push('Elevated fakeout profile');
    if (scores.breadthStrong) lines.push('Strong breadth alignment');
    if (scores.reclaimHeld) lines.push('Reclaim held after trigger');
    if (scores.continuationStrong) lines.push('Strong continuation at 5m/15m');
    if (scores.expansionLeg >= 3) lines.push(`Expansion leg ~${scores.expansionLeg}`);
    return lines.slice(0, 5);
  }

  private toSnapshot(input: LiveExecutionQualityInput): SignalSnapshot {
    const ext = input.extended ?? (Math.abs(input.vwapDistance ?? 0) * 100 >= 5);
    return {
      id: 'live',
      symbol: input.symbol.toUpperCase(),
      timestamp: Date.now(),
      timeframe: '5m',
      direction: 'LONG',
      signalType: (input.signalType as SignalSnapshot['signalType']) ?? 'MOMENTUM',
      marketRegime: (input.marketRegime as SignalSnapshot['marketRegime']) ?? 'TREND',
      entryPrice: 100,
      stopPrice: 98,
      convictionScore: 70,
      rvol: input.rvol ?? 2,
      trendAlignment: input.trendAlignment ?? 60,
      vwapDistance: input.vwapDistance,
      sessionTimeMinutes: input.sessionTimeMinutes,
      extendedEntry: ext,
      captureStage: input.captureStage ?? 'TRIGGERED',
      createdAt: Date.now()
    };
  }
}
