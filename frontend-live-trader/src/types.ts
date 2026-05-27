export interface RankedOpportunity {
  symbol: string;
  regime: string;
  action: string;
  tone: string;
  badge: string;
  maturityState: string;
  conviction: number;
  convictionVelocity: number;
  persistenceSeconds: number;
  institutionalPressure: number;
  expansionProbability: number;
  dominanceScore: number;
  whyNow: string[];
  entryZoneLabel: string;
  riskLabel: string;
  emergingFast: boolean;
  degrading: boolean;
  updatedAt: number;
}

export interface Tier1Snapshot {
  dominant: RankedOpportunity | null;
  topRanked: RankedOpportunity[];
  degrading: RankedOpportunity[];
  generatedAt: number;
  feedGeneration: number;
}

export interface RuntimeControls {
  scanningEnabled: boolean;
  telegramEnabled: boolean;
  autoExecutionEnabled: boolean;
  executionMode: 'OFF' | 'PAPER_RESEARCH' | string;
}

export interface MarketEmotion {
  label?: string;
  description?: string;
}

export interface LiveTraderSnapshot {
  tier1: Tier1Snapshot;
  market: { marketEmotion?: MarketEmotion | string; sessionMode?: string; pulses?: string[] } | null;
  paperStatus: {
    mode: string;
    ibkrConnected: boolean;
    safety: { allowed: boolean; reason: string | null };
  };
  activePositions: Array<{
    id: number;
    symbol: string;
    regime: string;
    entryPrice?: number;
    fillPrice?: number;
    quantity?: number;
    mfeR?: number;
    maeR?: number;
    realizedR?: number;
    status: string;
    exitSuggestion?: string;
  }>;
  pnl: {
    unrealizedSumR: number;
    realizedSumR: number;
    openPositions: number;
    closedToday: number;
  };
  advisories: string[];
  runtime: RuntimeControls;
}
