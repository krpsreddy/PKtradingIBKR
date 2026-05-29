import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface IdealEntryZoneDto {
  low: number;
  high: number;
  label: string;
}

export interface IntelligenceBarSnapshotDto {
  symbol: string;
  sessionDate: string;
  barIndex: number;
  timestamp: number;
  regime: string;
  classification: string;
  triggerType: string;
  traderAction: string;
  continuationIntegrity: number;
  expansionProbability: number;
  exhaustionProbability: number;
  entryZone: IdealEntryZoneDto | null;
  chartZone: string;
  markerText: string;
  markerColor: string;
  markerShape: string;
  markerPosition: string;
  addOpportunity: boolean;
  triggerReason: string;
  whyValid: string;
}

export interface ReplayMarkerDto {
  timestamp: number;
  markerText: string;
  markerColor: string;
  shape: string;
  position: string;
}

export interface TimelineEventDto {
  timestamp: number;
  timeLabel: string;
  eventType: string;
  label: string;
  detail: string;
  triggerScore: number;
}

export interface ExecutionCardDto {
  symbol: string;
  action: string;
  entryType: string;
  continuationIntegrity: string;
  rvolLabel: string;
  shallowPbQuality: string;
  vwapPersistenceLabel: string;
  expansionProbability: number;
  idealEntryZone: IdealEntryZoneDto | null;
  continuationRisk: string;
  triggerReason: string;
  windowLabel: string;
}

export interface LiveRegimeSnapshotDto {
  advisoryOnly: boolean;
  lookbackDays: number;
  generatedAt: number;
  analyticsVersion: number;
  sampleCount: number;
  activeContinuationRegimes: {
    symbol: string;
    regimeType: string;
    classification: string;
    expansionProbability: number;
    continuationPersistenceScore: number;
    sessionTimeMinutes?: number;
  }[];
  participationOpportunities: {
    symbol: string;
    classification: string;
    expansionProbability: number;
    shallowPullbackQuality: number;
    windowLabel: string;
    advisoryNote: string;
  }[];
  summaryInsights: string[];
}

export interface ExecutionCardsSnapshotDto {
  advisoryOnly: boolean;
  generatedAt: number;
  analyticsVersion: number;
  symbol: string;
  cards: ExecutionCardDto[];
  summaryInsights: string[];
}

export interface ReplayTimelineSnapshotDto {
  advisoryOnly: boolean;
  generatedAt: number;
  analyticsVersion: number;
  symbol: string;
  sessionDate: string;
  bars: IntelligenceBarSnapshotDto[];
  replayMarkers: ReplayMarkerDto[];
  timelineEvents: TimelineEventDto[];
  visualizationPayload: {
    triggerCount: number;
    addOpportunityCount: number;
    exhaustionCount: number;
    dominantRegime: string;
  };
}

/** Phase 164 — HTTP client for backend intelligence snapshots. */
@Injectable({ providedIn: 'root' })
export class IntelligenceSnapshotApiService {
  private readonly base = environment.apiUrl.replace(/\/api$/, '');

  constructor(private http: HttpClient) {}

  liveRegime(symbol: string, lookbackDays?: number): Observable<LiveRegimeSnapshotDto> {
    const q = lookbackDays != null ? `?lookbackDays=${lookbackDays}` : '';
    return this.http.get<LiveRegimeSnapshotDto>(`${this.base}/api/live-regime/${symbol.toUpperCase()}${q}`);
  }

  executionCards(symbol: string, lookbackDays?: number): Observable<ExecutionCardsSnapshotDto> {
    const q = lookbackDays != null ? `?lookbackDays=${lookbackDays}` : '';
    return this.http.get<ExecutionCardsSnapshotDto>(`${this.base}/api/execution-cards/${symbol.toUpperCase()}${q}`);
  }

  replayTimeline(symbol: string, session: string): Observable<ReplayTimelineSnapshotDto> {
    return this.http.get<ReplayTimelineSnapshotDto>(
      `${this.base}/api/replay-timeline/${symbol.toUpperCase()}/${session}`
    );
  }

  replayTrigger(symbol: string, session: string): Observable<ReplayTimelineSnapshotDto> {
    return this.http.get<ReplayTimelineSnapshotDto>(
      `${this.base}/api/replay-trigger/${symbol.toUpperCase()}/${session}`
    );
  }

  /** Phase 187 — full watchlist live scan (no per-symbol URL limit). */
  liveScannerSnapshot(): Observable<ScannerSnapshotDto> {
    return this.http.get<ScannerSnapshotDto>(`${this.base}/api/live-scanner/snapshot`);
  }

  scannerOpportunities(
    symbols?: string[],
    lookbackDays?: number,
    mode: 'live' | 'historical' = 'live'
  ): Observable<ScannerSnapshotDto> {
    const params = new URLSearchParams();
    params.set('mode', mode);
    if (symbols?.length) {
      for (const s of symbols) params.append('symbols', s.toUpperCase());
    }
    if (lookbackDays != null) params.set('lookbackDays', String(lookbackDays));
    return this.http.get<ScannerSnapshotDto>(`${this.base}/api/scanner/opportunities?${params}`);
  }
}

export interface ScannerOpportunityDto {
  symbol: string;
  opportunityType: string;
  action: string;
  tone: string;
  badge: string;
  convictionScore: number;
  expansionProbability: number;
  continuationPersistence: number;
  triggerIntegrity: number;
  institutionalPressure: number;
  exhaustionProbability: number;
  executionQuality: number;
  entryZoneLabel: string;
  riskLabel: string;
  whyNow: string[];
  windowLabel: string;
  rvolLabel: string;
}

export interface ScannerSnapshotDto {
  advisoryOnly: boolean;
  generatedAt: number;
  symbols: string[];
  opportunities: ScannerOpportunityDto[];
  summaryInsights: string[];
}
