import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type HistoricalLookbackDays = 7 | 30 | 60 | 90;
export type HistoricalDiscoveryDirection = 'bullish' | 'bearish';

export interface HistoricalBulkDiscoveryReport {
  meta: {
    lookbackDays: number;
    sampleCount: number;
    generatedAtMs: number;
    disclaimer: string;
    direction?: string;
    focusLabel?: string;
  };
  insights: string[];
  regimeDiscovery: HistoricalRegimeRow[];
  regimeFamilies: RegimeFamilyCluster[];
  marketStructure: MarketStructureRow[];
  continuationProfiles: ContinuationProfileRow[];
  failureClusters: FailureCluster[];
  sectorDna: SectorDnaRow[];
  sessionBehavior: SessionBehaviorRow[];
  trendMaturity: TrendMaturityRow[];
  regimeEvolution: RegimeEvolutionPath[];
  historicalVsLive: HistoricalVsLiveRow[];
  topDiscoveries: HistoricalRegimeRow[];
  putEntryQuality?: PutEntryQualityRow[];
  squeezeRisk?: SqueezeRiskRow[];
  breakdownProfiles?: BreakdownProfileRow[];
}

export interface PutEntryQualityRow {
  grade: string;
  sampleCount: number;
  followThroughPct: number;
  breakdownSurvivalPct: number;
  discoveryConfidenceScore: number;
}

export interface SqueezeRiskRow {
  context: string;
  sampleCount: number;
  squeezeRiskScore: number;
  note: string;
}

export interface BreakdownProfileRow {
  profile: string;
  sampleCount: number;
  breakdownSurvivalPct: number;
  failedBouncePct: number;
  accelerationPct: number;
  squeezeRiskAvg: number;
}

export interface HistoricalRegimeRow {
  regime: string;
  frequency: number;
  winRate: number;
  avgMfeR: number;
  continuationProbability: number;
  secondLegSurvivalPct: number;
  failureProbability: number;
  discoveryConfidenceScore: number;
  expectancyLabel: string;
}

export interface RegimeFamilyCluster {
  family: string;
  sampleCount: number;
  winRate: number;
  avgMfeR: number;
  continuationPct: number;
  memberRegimes: string[];
  discoveryConfidenceScore: number;
}

export interface MarketStructureRow {
  structure: string;
  sampleCount: number;
  winRate: number;
  continuationPct: number;
  note: string;
}

export interface ContinuationProfileRow {
  profile: string;
  sampleCount: number;
  persistenceSurvivalPct: number;
  secondLegProbability: number;
  exhaustionTimingScore: number;
  trendDecayPct: number;
}

export interface FailureCluster {
  clusterKey: string;
  failureCount: number;
  sharePct: number;
  conditions: string[];
}

export interface SectorDnaRow {
  sector: string;
  sampleCount: number;
  continuationPct: number;
  failurePct: number;
  strengthNote: string;
}

export interface SessionBehaviorRow {
  session: string;
  sampleCount: number;
  winRate: number;
  continuationPct: number;
  topRegime: string;
}

export interface TrendMaturityRow {
  maturity: string;
  sampleCount: number;
  continuationPct: number;
  failurePct: number;
}

export interface RegimeEvolutionPath {
  path: string;
  occurrences: number;
  successPct: number;
}

export interface HistoricalVsLiveRow {
  regime: string;
  historicalWinPct: number;
  paperWinPct: number;
  historicalCapturePct: number;
  paperCapturePct: number;
  gapPct: number;
  verdict: string;
}

@Injectable({ providedIn: 'root' })
export class HistoricalBulkDiscoveryApi {
  private readonly base = `${environment.apiUrl}/discovery`;

  constructor(private http: HttpClient) {}

  load(
    days: HistoricalLookbackDays = 60,
    refresh = false,
    direction: HistoricalDiscoveryDirection = 'bullish'
  ): Promise<HistoricalBulkDiscoveryReport> {
    const path =
      direction === 'bearish'
        ? refresh
          ? 'historical-bulk/bearish/refresh'
          : 'historical-bulk/bearish'
        : refresh
          ? 'historical-bulk/bullish/refresh'
          : 'historical-bulk/bullish';
    const url = `${this.base}/${path}`;
    const req = refresh
      ? this.http.post<HistoricalBulkDiscoveryReport>(url, null, { params: { days } })
      : this.http.get<HistoricalBulkDiscoveryReport>(url, { params: { days } });
    return firstValueFrom(req);
  }
}
