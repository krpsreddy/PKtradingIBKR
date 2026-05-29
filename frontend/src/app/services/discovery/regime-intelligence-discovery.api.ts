import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export type LookbackDays = 7 | 30 | 60 | 90;

export interface LookbackMeta {
  days: number;
  fromDate: string;
  toDate: string;
  closedTrades: number;
  decisionTraces: number;
}

export interface RegimePerformanceRow {
  regime: string;
  tradeCount: number;
  winRate: number;
  avgR: number;
  continuationCapturePct: number;
  avgHoldSec: number;
  avgMfeR: number;
  avgMaeR: number;
  secondLegSurvivalPct: number;
  bestEnvironment: string;
  failureRate: number;
}

export interface StructureFitCell {
  regime: string;
  marketStructure: string;
  tradeCount: number;
  winRate: number;
  avgR: number;
  continuationCapturePct: number;
  verdict: string;
}

export interface EntryQualityRow {
  entryQuality: string;
  tradeCount: number;
  winRate: number;
  avgR: number;
  continuationCapturePct: number;
  continuationSurvivalPct: number;
  failureProbability: number;
}

export interface ExitQualityRow {
  exitType: string;
  tradeCount: number;
  continuationCapturePct: number;
  avgR: number;
  prematureExitRate: number;
  holdEfficiency: number;
}

export interface ContinuationCaptureRow {
  dimension: string;
  bucket: string;
  tradeCount: number;
  continuationCapturePct: number;
  avgR: number;
}

export interface SessionRow {
  sessionPeriod: string;
  tradeCount: number;
  winRate: number;
  avgR: number;
  continuationCapturePct: number;
  strongestRegime: string;
}

export interface SectorRow {
  sector: string;
  tradeCount: number;
  winRate: number;
  avgR: number;
  continuationCapturePct: number;
  topRegime: string;
}

export interface BearishAssistRow {
  bearishState: string;
  triggerCount: number;
  avgBias: number;
  followThroughPct: number;
  bounceFailurePct: number;
  note: string;
}

export interface FailureCluster {
  clusterKey: string;
  lossCount: number;
  avgLossR: number;
  shareOfLossesPct: number;
  conditions: string[];
}

export interface DecisionTraceInsight {
  category: string;
  count: number;
  avgOutcomeR: number;
  summary: string;
}

export interface DiscoveryInsights {
  insights: string[];
  sampleSize: number;
  disclaimer: string;
}

export interface RegimeIntelligenceReport {
  meta: LookbackMeta;
  topRegimes: RegimePerformanceRow[];
  marketStructureFit: StructureFitCell[];
  entryQuality: EntryQualityRow[];
  exitQuality: ExitQualityRow[];
  continuationCapture: ContinuationCaptureRow[];
  sessionAnalysis: SessionRow[];
  sectorAnalysis: SectorRow[];
  bearishAnalysis: BearishAssistRow[];
  failureClusters: FailureCluster[];
  decisionTraceAnalysis: DecisionTraceInsight[];
  clusterArchitecture: { status: string; description: string; plannedDimensions: string[] };
  insights: DiscoveryInsights;
}

@Injectable({ providedIn: 'root' })
export class RegimeIntelligenceDiscoveryApi {
  private readonly base = `${environment.apiUrl}/discovery`;

  constructor(private http: HttpClient) {}

  loadReport(days: LookbackDays = 60): Promise<RegimeIntelligenceReport> {
    return firstValueFrom(
      this.http.get<RegimeIntelligenceReport>(`${this.base}/regime-intelligence`, { params: { days } })
    );
  }
}
