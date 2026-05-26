export interface HistoricalInsight {
  setupType: string;
  symbol: string | null;
  lookbackDays: number;
  winRate: number;
  avgMovePercent: number | null;
  bestRegime: string | null;
  worstRegime: string | null;
  bestTimeWindow: string | null;
  typicalFailureTime: string | null;
  probabilisticNotes: string[];
}

export interface SetupStatistics {
  setupType: string;
  lookbackDays: number;
  sampleSize: number;
  winRate: number;
  avgRr: number | null;
  avgContinuation: number | null;
  bestRegime: string | null;
  worstRegime: string | null;
  bestTimeWindow: string | null;
  followThroughProbability: number | null;
  insights: string[];
}

export interface ReplayDates {
  symbol: string;
  availableDates: string[];
  lookbackDays: number;
}
