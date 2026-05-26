export type BottomTabId =
  | 'history'
  | 'journal'
  | 'replay'
  | 'timeline'
  | 'edge'
  | 'intelligence'
  | 'notes'
  | 'session'
  | 'playbooks';

export interface TraderEdge {
  lookbackDays: number;
  sampleSize: number;
  overallWinRate: number;
  bestSetupTypes: string[];
  worstSetupTypes: string[];
  bestRegimes: string[];
  bestTimeWindows: string[];
  bestEntryQuality: string[];
  summary: string;
}

export interface BehaviorInsight {
  type: string;
  title: string;
  detail: string;
}

export interface ReplayCoaching {
  symbol: string;
  idealActions: string[];
  dangerousSignals: string[];
  lessons: string[];
}

export interface StatisticalConfidence {
  signalType: string;
  regime: string;
  winRatePercent: number;
  label: string;
}

export interface Playbook {
  id: string;
  name: string;
  idealConditions: string[];
  avoidConditions: string[];
  historicalWinRate: number | null;
  bestRegimes: string[];
  entryTiming: string;
  regimePerformance?: RegimePerformance[];
  contextualStatus?: string | null;
  contextualReason?: string | null;
}

export interface RegimePerformance {
  regime: string;
  winRate: number;
  label: string;
}

export interface SessionReview {
  sessionDate: string;
  topSetups: string[];
  missedOpportunities: string[];
  strongestSectors: string[];
  failedSetups: string[];
  regimeShifts: string[];
  summary: string;
}

export const DEFAULT_PLAYBOOKS: Playbook[] = [
  {
    id: 'EARLY_EXPANSION',
    name: 'Early Expansion Playbook',
    idealConditions: ['RVOL acceleration', 'Range expansion developing', 'VWAP acceptance forming', 'DEVELOPING maturity'],
    avoidConditions: ['Exhaustion drift', 'Late extension without persistence', 'Choppy regime'],
    historicalWinRate: 58,
    bestRegimes: ['TRENDING_BULL', 'RISK_ON'],
    entryTiming: 'Pre-confirmation early mode · scale on persistence validation'
  },
  {
    id: 'INSTITUTIONAL_PERSISTENCE',
    name: 'Institutional Persistence Playbook',
    idealConditions: ['Continuation integrity HIGH', 'Participation sustainment', 'Institutional pressure elevated'],
    avoidConditions: ['Acceleration decay', 'Persistence degradation', 'Exhaustion risk rising'],
    historicalWinRate: 62,
    bestRegimes: ['TRENDING_BULL'],
    entryTiming: 'Confirmed continuation · add on shallow PB hold'
  },
  {
    id: 'HEALTHY_PULLBACK',
    name: 'Healthy Pullback Continuation',
    idealConditions: ['Shallow PB efficiency', 'VWAP integrity intact', 'Acceleration integrity preserved'],
    avoidConditions: ['Deep pullback', 'VWAP loss', 'Participation fade'],
    historicalWinRate: 68,
    bestRegimes: ['TRENDING_BULL', 'RISK_ON'],
    entryTiming: 'Pullback completion with persistence confirmation'
  },
  {
    id: 'VWAP_ACCEPTANCE',
    name: 'VWAP Acceptance Continuation',
    idealConditions: ['VWAP reclaim + hold', 'Participation increasing', 'Not late extension'],
    avoidConditions: ['Chop', 'Low participation reclaim', 'Exhaustion drift'],
    historicalWinRate: 64,
    bestRegimes: ['RISK_ON'],
    entryTiming: 'On sustained VWAP acceptance with expansion probability'
  },
  {
    id: 'COMPRESSION_BREAKOUT',
    name: 'Compression Breakout Playbook',
    idealConditions: ['Volatility contraction', 'Breakout pressure building', 'Compression ready state'],
    avoidConditions: ['False expansion', 'Low RVOL release', 'Regime transition failure'],
    historicalWinRate: 58,
    bestRegimes: ['BREAKOUT', 'RISK_ON'],
    entryTiming: 'On compression release with trigger integrity'
  },
  {
    id: 'EXHAUSTION_AVOID',
    name: 'Exhaustion Avoidance Framework',
    idealConditions: ['Exhaustion drift detected', 'Late extension fade', 'Acceleration decay'],
    avoidConditions: ['Chasing extended moves', 'Ignoring persistence degradation'],
    historicalWinRate: 0,
    bestRegimes: ['CHOPPY', 'EXHAUSTING'],
    entryTiming: 'AVOID / EXIT — do not chase exhaustion regimes'
  }
];

export interface MarketMemory {
  sessionDate: string;
  strongestSetups: string[];
  failingSetups: string[];
  openMomentumSuccessRate: number | null;
  continuationSuccessRate: number | null;
  emergingSetupCount: number;
  narratives?: string[];
  regimeSetupWinRates?: Record<string, number>;
  fakeBreakoutFrequency?: number | null;
  middayDeteriorationRate?: number | null;
  closeStrengthRate?: number | null;
  lookbackDays?: number;
}

export interface RankingExplanation {
  type: 'boost' | 'downgrade' | 'neutral';
  message: string;
}

export type TraderStateId =
  | 'disciplined'
  | 'patient'
  | 'aggressive'
  | 'chasing'
  | 'revenge-risk'
  | 'overtrading-risk';

export interface TraderStateView {
  id: TraderStateId;
  label: string;
  detail: string;
}

export function confidenceTier(pct: number): 'high' | 'mid' | 'low' {
  if (pct >= 70) return 'high';
  if (pct >= 50) return 'mid';
  return 'low';
}

export function deriveTraderState(behavior: BehaviorInsight[]): TraderStateView {
  const types = new Set(behavior.map(b => b.type?.toUpperCase() ?? ''));
  if (types.has('REVENGE') || types.has('REVENGE_TRADING')) {
    return { id: 'revenge-risk', label: 'Revenge Risk', detail: 'Step back — recent behavior shows revenge patterns.' };
  }
  if (types.has('OVERTRADING') || types.has('OVERTRADE')) {
    return { id: 'overtrading-risk', label: 'Overtrading Risk', detail: 'Reduce size and wait for A-quality only.' };
  }
  if (types.has('CHASING') || types.has('LATE_ENTRY')) {
    return { id: 'chasing', label: 'Chasing', detail: 'Late entries underperforming — wait for pullbacks.' };
  }
  if (types.has('AGGRESSIVE')) {
    return { id: 'aggressive', label: 'Aggressive', detail: 'High activity — verify each setup meets playbook rules.' };
  }
  if (types.has('NO_EDGE_AVOIDED')) {
    return { id: 'disciplined', label: 'Disciplined', detail: 'Avoiding no-edge setups — strong process today.' };
  }
  return { id: 'patient', label: 'Patient', detail: 'Waiting for quality — maintain selectivity.' };
}

export function deriveRankingExplanations(
  memory: MarketMemory | null,
  behavior: BehaviorInsight[],
  regime: string | null
): RankingExplanation[] {
  const out: RankingExplanation[] = [];
  if (memory?.strongestSetups?.length) {
    out.push({ type: 'boost', message: `${memory.strongestSetups.slice(0, 2).join(', ')} boosted from session win rate` });
  }
  if (memory?.failingSetups?.length) {
    out.push({ type: 'downgrade', message: `${memory.failingSetups.slice(0, 2).join(', ')} downgraded today` });
  }
  if (regime === 'CHOPPY') {
    out.push({ type: 'downgrade', message: 'OPEN_MOM downgraded in CHOPPY regime' });
  }
  if (memory?.continuationSuccessRate != null && memory.continuationSuccessRate >= 65) {
    out.push({ type: 'boost', message: 'CONT setups outperforming today' });
  }
  for (const b of behavior.slice(0, 2)) {
    if (b.title) out.push({ type: 'neutral', message: b.title });
  }
  return out.slice(0, 5);
}
