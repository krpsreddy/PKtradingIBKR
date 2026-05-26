import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IntelligenceOffloadService } from '../intelligence-offload/intelligence-offload.service';
import { ReplayMarkerDto, ReplayTimelineSnapshotDto } from '../intelligence-offload/intelligence-snapshot-api.service';

/** Phase 164 — cached replay timeline for video-playback mode (no client rescoring). */
@Injectable({ providedIn: 'root' })
export class ReplayIntelligenceCacheService {
  private currentSymbol = '';
  private currentSession = '';
  private timeline: ReplayTimelineSnapshotDto | null = null;

  constructor(private offload: IntelligenceOffloadService) {}

  preload(symbol: string, sessionDate: string): Observable<ReplayTimelineSnapshotDto> {
    this.currentSymbol = symbol.toUpperCase();
    this.currentSession = sessionDate;
    return this.offload.loadReplayTimeline(symbol, sessionDate);
  }

  setTimeline(symbol: string, session: string, timeline: ReplayTimelineSnapshotDto): void {
    this.currentSymbol = symbol.toUpperCase();
    this.currentSession = session;
    this.timeline = timeline;
  }

  getMarkers(symbol: string, session: string): ReplayMarkerDto[] | null {
    if (this.timeline && this.currentSymbol === symbol.toUpperCase() && this.currentSession === session) {
      return this.timeline.replayMarkers;
    }
    return this.offload.getCachedMarkers(symbol, session);
  }

  getTimeline(): ReplayTimelineSnapshotDto | null {
    return this.timeline;
  }

  clear(): void {
    this.timeline = null;
    this.currentSymbol = '';
    this.currentSession = '';
  }
}
