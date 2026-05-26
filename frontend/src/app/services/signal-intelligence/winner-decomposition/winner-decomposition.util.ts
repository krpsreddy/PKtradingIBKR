import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import {
  ConfidenceTier,
  EntryLocationType,
  GovernanceSnapshot,
  IndicatorSnapshot,
  MarketStructureSnapshot,
  NarrativeSnapshot,
  PreEntryEnvironment
} from './winner-decomposition.models';
import { LiveExecutionDecision } from '../live-decision/live-decision.models';
import {
  contextFromSignal,
  decisionForSignal,
  expansionCapturePct,
  isAvoidDecision,
  isWaitDecision,
  narrativeStability,
  round2
} from '../adaptive-calibration/adaptive-calibration.util';
import { MarketStateMachineEngine } from '../market-state/market-state-machine.engine';
import { ContinuationAcceptanceEngine } from '../entry-sequencing/continuation-acceptance.engine';
import { PullbackStabilityEngine } from '../entry-sequencing/pullback-stability.engine';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { EntryAcceptanceSequencingEngine } from '../entry-sequencing/entry-acceptance-sequencing.engine';

export const MIN_AUTHORITATIVE = 10;
export const MIN_LOW_CONFIDENCE = 25;

const marketState = new MarketStateMachineEngine();
const continuationEngine = new ContinuationAcceptanceEngine();
const pullbackEngine = new PullbackStabilityEngine();
const falseBreakout = new FalseBreakoutAnalyticsEngine();
const sequencer = new EntryAcceptanceSequencingEngine();

export interface AmdCaseStudySpec {
  id: string;
  label: string;
  symbol: string;
  entryZone: [number, number];
  targetZone: [number, number];
  narrativeHint: string;
}

export const AMD_CASE_STUDIES: AmdCaseStudySpec[] = [
  {
    id: 'amd-340-355',
    label: 'AMD 340→355',
    symbol: 'AMD',
    entryZone: [338, 346],
    targetZone: [352, 358],
    narrativeHint: 'opening drive continuation'
  },
  {
    id: 'amd-396-425',
    label: 'AMD 396→425',
    symbol: 'AMD',
    entryZone: [393, 402],
    targetZone: [418, 430],
    narrativeHint: 'reclaim continuation after flush'
  }
];

export function confidenceTier(n: number): ConfidenceTier {
  if (n < MIN_AUTHORITATIVE) return 'INSUFFICIENT';
  if (n < MIN_LOW_CONFIDENCE) return 'LOW';
  if (n < 50) return 'MODERATE';
  return 'HIGH';
}

export function mfeR(s: SignalSnapshot): number {
  return s.evaluation?.mfeR ?? 0;
}

export function resultBucket(s: SignalSnapshot): 'GT_3R' | 'GT_2R' | 'WINNER' | 'NEUTRAL' {
  const r = mfeR(s);
  if (r >= 3) return 'GT_3R';
  if (r >= 2 || s.evaluation?.hit2R) return 'GT_2R';
  if (s.evaluation?.status === 'WIN' || r >= 0.5) return 'WINNER';
  return 'NEUTRAL';
}

export function isLargeWinner(s: SignalSnapshot): boolean {
  return resultBucket(s) === 'GT_2R' || resultBucket(s) === 'GT_3R';
}

export function isLowFakeoutRunner(s: SignalSnapshot): boolean {
  return isLargeWinner(s) && !falseBreakout.isFalseBreakout(s);
}

export function sessionDateFromTs(ts: number): string {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function sessionWindow(minutes: number | undefined): string {
  const m = minutes ?? 999;
  if (m <= 15) return '9:30–9:45';
  if (m <= 45) return '9:45–10:15';
  if (m <= 90) return '10:15–11:00';
  return '11:00+';
}

export function rvolBucket(rvol: number): string {
  if (rvol < 1.5) return '<1.5';
  if (rvol < 3) return '1.5–3';
  if (rvol < 5) return '3–5';
  return '>5';
}

export function vwapDistanceBucket(dist: number | undefined): string {
  const d = Math.abs(dist ?? 0);
  if (d < 0.003) return 'AT_VWAP';
  if (d < 0.01) return 'NEAR';
  return 'EXTENDED';
}

export function breadthBucket(trendAlignment: number): string {
  if (trendAlignment >= 70) return 'STRONG';
  if (trendAlignment >= 45) return 'MID';
  return 'WEAK';
}

export function classifyEntryLocation(s: SignalSnapshot): EntryLocationType {
  const src = (s.sourceSignalType ?? s.signalType ?? '').toUpperCase();
  const path = marketState.path(s).current;
  const pathStr = String(path).toUpperCase();

  if (pathStr.includes('SECOND_LEG') || src.includes('SECOND') || src.includes('CONT')) return 'SECOND_LEG';
  if (pathStr.includes('VWAP_RECLAIM') || src.includes('RECLAIM') || src.includes('VWAP')) return 'VWAP_RECLAIM';
  if (pathStr.includes('PULLBACK') || src.includes('PULL')) return 'PULLBACK_STABILIZATION';
  if (pathStr.includes('ACCEPTANCE') || pathStr.includes('POST_ACCEPTANCE')) return 'POST_ACCEPTANCE_CONTINUATION';
  if ((s.sessionTimeMinutes ?? 999) <= 20 || src.includes('OPEN') || src.includes('ORB')) return 'OPENING_DRIVE';
  if (src.includes('BREAK') || s.signalType === 'BREAKOUT') return 'BREAKOUT_HOLD';
  if (pathStr.includes('RECLAIM')) return 'RECLAIM';
  return 'UNKNOWN';
}

export function extractMarketStructure(s: SignalSnapshot): MarketStructureSnapshot {
  const path = marketState.path(s);
  const states = path.states.map(x => String(x).toUpperCase());
  const cont = continuationEngine.classify(s);
  const pull = pullbackEngine.classify(s);

  return {
    higherLows: cont === 'STRONG_ACCEPTANCE' || cont === 'VERY_STRONG_ACCEPTANCE',
    compression: pull === 'VERY_STABLE' || pull === 'STABLE',
    trendAligned: (s.trendAlignment ?? 0) >= 55,
    reclaimAfterFlush: states.some(st => st.includes('RECLAIM')) && states.some(st => st.includes('FLUSH') || st.includes('FAILED')),
    acceptanceAboveVwap: (s.vwapDistance ?? 0) >= 0 && Math.abs(s.vwapDistance ?? 0) < 0.015,
    orbHold: (s.sessionTimeMinutes ?? 999) <= 30 && s.marketRegime === 'TREND'
  };
}

export function extractIndicators(s: SignalSnapshot): IndicatorSnapshot {
  return {
    rvol: s.rvol ?? 0,
    rvolBucket: rvolBucket(s.rvol ?? 0),
    emaStack: s.emaAlignment === true,
    trendAlignment: s.trendAlignment ?? 0,
    vwapDistance: s.vwapDistance ?? 0,
    vwapDistanceBucket: vwapDistanceBucket(s.vwapDistance),
    sessionMinutes: s.sessionTimeMinutes ?? 0,
    sessionWindow: sessionWindow(s.sessionTimeMinutes),
    extendedEntry: s.extendedEntry === true
  };
}

export function extractNarrative(s: SignalSnapshot, sampleCount: number): NarrativeSnapshot {
  const path = marketState.path(s);
  return {
    path: marketState.transitionSummary(path),
    trajectory: path.trajectory,
    stability: narrativeStability(s),
    continuationAcceptance: continuationEngine.classify(s),
    pullbackStability: pullbackEngine.classify(s),
    fakeoutRisk: falseBreakout.isFalseBreakout(s) ? 'HIGH' : 'LOW'
  };
}

export function extractGovernance(s: SignalSnapshot, sampleCount: number): GovernanceSnapshot {
  const decision = decisionForSignal(s, sampleCount);
  const suppressed = isLargeWinner(s) && (isWaitDecision(decision.decision) || isAvoidDecision(decision.decision));
  const reasons: string[] = [];

  if (s.extendedEntry) reasons.push('Extended entry penalty');
  if (falseBreakout.isFalseBreakout(s)) reasons.push('Fakeout fear elevated');
  if ((s.convictionScore ?? 0) < 55) reasons.push('Low conviction band');
  if (continuationEngine.classify(s) === 'FAILING_ACCEPTANCE') reasons.push('Continuation not accepted');
  if (pullbackEngine.classify(s) === 'FAILING') reasons.push('Deep pullback — wait bias');
  if (isWaitDecision(decision.decision)) reasons.push('Sequencing prefers pullback hold');
  if (isAvoidDecision(decision.decision)) reasons.push('Governance trap/exhaustion guard');

  const wouldFullExecution =
    isLargeWinner(s)
    && !isAvoidDecision(decision.decision)
    && (s.convictionScore ?? 0) >= 65
    && continuationEngine.classify(s) !== 'FAILING_ACCEPTANCE';

  return {
    decision: decision.decision,
    reason: decision.keyReason,
    convictionBand: bandFromScore(s.convictionScore ?? 0),
    suppressedWinner: suppressed,
    wouldFullExecution,
    suppressionReasons: reasons
  };
}

export function extractPreEntryEnvironment(s: SignalSnapshot, sampleCount: number): PreEntryEnvironment {
  return {
    signalId: s.id,
    symbol: s.symbol,
    sessionDate: sessionDateFromTs(s.timestamp),
    timestamp: s.timestamp,
    entryLocation: classifyEntryLocation(s),
    marketStructure: extractMarketStructure(s),
    indicators: extractIndicators(s),
    narrative: extractNarrative(s, sampleCount),
    governance: extractGovernance(s, sampleCount)
  };
}

export function bandFromScore(score: number): string {
  if (score >= 90) return 'ELITE';
  if (score >= 75) return 'HIGH';
  if (score >= 55) return 'MODERATE';
  if (score >= 35) return 'LOW';
  return 'AVOID';
}

export function expansionEfficiency(s: SignalSnapshot): number {
  return expansionCapturePct(s);
}

export function sessionMovePct(s: SignalSnapshot): number {
  const entry = s.entryPrice;
  const max = s.evaluation?.maxPriceSeen ?? entry;
  if (!entry || entry <= 0) return 0;
  return round2(((max - entry) / entry) * 100);
}

export function matchesAmdCaseStudy(s: SignalSnapshot, spec: AmdCaseStudySpec): boolean {
  if (s.symbol !== spec.symbol) return false;
  const entry = s.entryPrice;
  const max = s.evaluation?.maxPriceSeen ?? entry;
  const inEntry = entry >= spec.entryZone[0] && entry <= spec.entryZone[1];
  const reachedTarget = max >= spec.targetZone[0];
  return inEntry && reachedTarget && isLargeWinner(s);
}

export function preconditionsList(pre: PreEntryEnvironment): string[] {
  const out: string[] = [];
  const { marketStructure: ms, indicators: ind, narrative: nar } = pre;
  if (ms.higherLows) out.push('Higher lows forming');
  if (ms.compression) out.push('Pullback compression');
  if (ms.trendAligned) out.push('Trend alignment');
  if (ms.reclaimAfterFlush) out.push('Reclaim after flush');
  if (ms.acceptanceAboveVwap) out.push('Acceptance above VWAP');
  if (ms.orbHold) out.push('ORB hold');
  if (ind.rvol >= 2) out.push(`RVOL ${ind.rvolBucket}`);
  if (ind.emaStack) out.push('EMA stack aligned');
  if (nar.continuationAcceptance !== 'FAILING_ACCEPTANCE') out.push(`Continuation ${nar.continuationAcceptance}`);
  if (nar.stability >= 60) out.push('Narrative stability');
  return out;
}

export function sequencingLabel(s: SignalSnapshot, sampleCount: number): string {
  return sequencer.sequence(s, sampleCount).finalState;
}
