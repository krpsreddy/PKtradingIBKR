import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { AutonomousOpportunityType } from '../../autonomous-regime-scanner/autonomous-regime-scanner.models';
import { FalseBreakoutAnalyticsEngine } from '../false-breakout-analytics.engine';
import { deriveMarketStateSequence, pathKey } from '../market-state/market-state.util';
import { breadthBucket, premarketBucket, rvolBucket, timeWindow } from '../edge-discovery/edge-cluster-metrics.util';
import { isEvaluatedSignal } from '../signal-intelligence.math';
import {
  formatAutonomousOpportunityType,
  resolveAutonomousOpportunityType
} from '../../../utils/autonomous-terminology.util';
import { PlaybookSequenceStep } from './playbook-candidate.models';

const falseBreakout = new FalseBreakoutAnalyticsEngine();
const MAX_STEP_GAP_MIN = 120;

export interface SessionGroup {
  symbol: string;
  sessionKey: string;
  signals: SignalSnapshot[];
}

export function groupBySession(signals: SignalSnapshot[]): SessionGroup[] {
  const map = new Map<string, SessionGroup>();
  for (const s of signals) {
    const key = `${s.symbol}|${sessionKeyFromTs(s.timestamp)}`;
    const g = map.get(key) ?? { symbol: s.symbol, sessionKey: key, signals: [] };
    g.signals.push(s);
    map.set(key, g);
  }
  return [...map.values()].map(g => ({
    ...g,
    signals: g.signals.sort((a, b) => a.timestamp - b.timestamp)
  }));
}

export function buildSequenceStep(s: SignalSnapshot, prev?: SignalSnapshot): PlaybookSequenceStep {
  const tags = deriveContextTags(s, prev);
  return {
    setup: resolveAutonomousOpportunityType(s),
    regime: s.marketRegime,
    rvolBucket: rvolBucket(s.rvol ?? 1),
    timeWindow: timeWindow(s.sessionTimeMinutes ?? 999),
    contextTags: tags
  };
}

/** Full fingerprint — used for simulation matching. */
export function sequenceKey(steps: PlaybookSequenceStep[]): string {
  return steps.map(s =>
    [s.setup, s.regime, s.rvolBucket, s.timeWindow, ...s.contextTags.sort()].join(':')
  ).join('→');
}

/** Coarser bucket key — groups similar sequences for statistical discovery. */
export function sequenceBucketKey(steps: PlaybookSequenceStep[]): string {
  return steps.map(s => {
    const tag = primaryContextTag(s.contextTags);
    return tag ? `${s.setup}+${tag}` : s.setup;
  }).join('→');
}

function primaryContextTag(tags: string[]): string | null {
  const priority = [
    'AFTER_FAILED_BREAKOUT', 'AFTER_FAKEOUT', 'OPENING_FLUSH_RECLAIM', 'RECLAIM_AFTER_BO',
    'SECOND_BREAKOUT', 'RECLAIM_CONTINUATION', 'DELAYED_CONTINUATION', 'RVOL_EXHAUSTION_REVERSION',
    'OPENING', 'POST_OPEN', 'LOW_RVOL', 'HIGH_RVOL', 'WEAK_BREADTH', 'STRONG_BREADTH'
  ];
  for (const p of priority) {
    if (tags.includes(p)) return p;
  }
  return tags[0] ?? null;
}

export function sequenceName(steps: PlaybookSequenceStep[]): string {
  const labels = steps.map(s => {
    const tag = s.contextTags[0];
    const setup = formatAutonomousOpportunityType(s.setup);
    return tag ? `${tag} ${setup}` : setup;
  });
  return labels.join(' → ');
}

export function sequenceDescription(steps: PlaybookSequenceStep[]): string {
  const parts = steps.map((s, i) => {
    const ctx = s.contextTags.length ? ` (${s.contextTags.join(', ')})` : '';
    return `Step ${i + 1}: ${formatAutonomousOpportunityType(s.setup)} in ${s.regime}${ctx}`;
  });
  return parts.join('; ');
}

/** Extract consecutive evaluated signal sequences within a session. */
export function extractSessionSequences(signals: SignalSnapshot[], lengths: number[] = [2, 3]): SignalSnapshot[][] {
  const evaluated = signals.filter(isEvaluatedSignal);
  const out: SignalSnapshot[][] = [];

  for (const len of lengths) {
    for (let i = 0; i <= evaluated.length - len; i++) {
      const slice = evaluated.slice(i, i + len);
      if (!withinGap(slice)) continue;
      out.push(slice);
    }
  }
  return out;
}

function withinGap(signals: SignalSnapshot[]): boolean {
  for (let i = 1; i < signals.length; i++) {
    const gapMin = (signals[i].timestamp - signals[i - 1].timestamp) / 60_000;
    if (gapMin > MAX_STEP_GAP_MIN) return false;
  }
  return true;
}

function opp(s: SignalSnapshot): AutonomousOpportunityType {
  return resolveAutonomousOpportunityType(s);
}

function deriveContextTags(s: SignalSnapshot, prev?: SignalSnapshot): string[] {
  const tags: string[] = [];
  const mins = s.sessionTimeMinutes ?? 999;

  if (mins < 15) tags.push('OPENING');
  if (mins >= 45 && mins < 120) tags.push('POST_OPEN');

  const pm = premarketBucket(s);
  if (pm === '>8%') tags.push('EXTENDED_PM');
  if (rvolBucket(s.rvol ?? 1) === '<1.5') tags.push('LOW_RVOL');
  if (rvolBucket(s.rvol ?? 1) === '>5') tags.push('HIGH_RVOL');

  if (breadthBucket(s) === 'WEAK') tags.push('WEAK_BREADTH');
  if (breadthBucket(s) === 'STRONG') tags.push('STRONG_BREADTH');

  if (prev) {
    const pev = prev.evaluation;
    if (pev?.status === 'LOSS' && opp(prev) === 'INSTITUTIONAL_ACCELERATION' && !pev.hit1R) {
      tags.push('AFTER_FAILED_BREAKOUT');
    }
    if (pev?.status === 'LOSS' && !pev.hit1R && falseBreakout.isFalseBreakout(prev)) {
      tags.push('AFTER_FAKEOUT');
    }
    if (opp(prev) === 'INSTITUTIONAL_ACCELERATION' && opp(s) === 'VWAP_PERSISTENCE') {
      tags.push('RECLAIM_AFTER_BO');
    }
    if (opp(prev) === 'INSTITUTIONAL_ACCELERATION' && opp(s) === 'INSTITUTIONAL_ACCELERATION' && pev?.status === 'LOSS') {
      tags.push('SECOND_BREAKOUT');
    }
    if ((prev.vwapDistance ?? 0) < -0.015 && opp(s) === 'VWAP_PERSISTENCE') {
      tags.push('OPENING_FLUSH_RECLAIM');
    }
    if (opp(prev) === 'EARLY_CONTINUATION' && rvolBucket(prev.rvol ?? 1) === '>5' && opp(s) === 'LATE_STAGE_EXHAUSTION') {
      tags.push('RVOL_EXHAUSTION_REVERSION');
    }
    if (opp(prev) === 'VWAP_PERSISTENCE' && opp(s) === 'TREND_RESUMPTION') {
      tags.push('RECLAIM_CONTINUATION');
    }
    if (mins >= 8 && mins < 20 && opp(s) === 'TREND_RESUMPTION' && opp(prev) !== 'TREND_RESUMPTION') {
      tags.push('DELAYED_CONTINUATION');
    }
  }

  if (s.extendedEntry) tags.push('LATE_ENTRY');
  if (opp(s) === 'LATE_STAGE_EXHAUSTION') tags.push('FAILED_BREAKDOWN');

  const narrativeStates = deriveMarketStateSequence(s);
  if (narrativeStates.length >= 2) {
    tags.push(`NARRATIVE_${pathKey(narrativeStates.slice(0, 3)).replace(/→/g, '_')}`);
  }
  if (narrativeStates.includes('FAILED_BREAKOUT') && narrativeStates.includes('VWAP_RECLAIM')) {
    tags.push('FAILED_BREAKOUT_RECLAIM');
  }
  if (narrativeStates.includes('SECOND_LEG_CONTINUATION')) tags.push('SECOND_LEG_NARRATIVE');

  return [...new Set(tags)];
}

function sessionKeyFromTs(ts: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(ts));
}
