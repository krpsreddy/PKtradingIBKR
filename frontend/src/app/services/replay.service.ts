import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ReplayHistory, ReplaySignalEvent, ReplaySpeed, BulkReplayHistory } from '../models/replay.model';

@Injectable({ providedIn: 'root' })
export class ReplayService {
  readonly apiBase = environment.apiUrl;

  private modeSubject = new BehaviorSubject<'LIVE' | 'REPLAY'>('LIVE');
  private historySubject = new BehaviorSubject<ReplayHistory | null>(null);
  private indexSubject = new BehaviorSubject<number>(-1);
  private playingSubject = new BehaviorSubject<boolean>(false);
  private speedSubject = new BehaviorSubject<ReplaySpeed>(1);
  private selectedEventSubject = new BehaviorSubject<ReplaySignalEvent | null>(null);

  mode$ = this.modeSubject.asObservable();
  history$ = this.historySubject.asObservable();
  currentIndex$ = this.indexSubject.asObservable();
  playing$ = this.playingSubject.asObservable();
  speed$ = this.speedSubject.asObservable();
  selectedEvent$ = this.selectedEventSubject.asObservable();

  private playTimer?: ReturnType<typeof setInterval>;

  constructor(private http: HttpClient) {}

  getMode(): 'LIVE' | 'REPLAY' {
    return this.modeSubject.value;
  }

  setMode(mode: 'LIVE' | 'REPLAY'): void {
    if (mode === 'LIVE') {
      this.stopPlayback();
      this.historySubject.next(null);
      this.indexSubject.next(-1);
      this.selectedEventSubject.next(null);
    }
    this.modeSubject.next(mode);
  }

  loadHistory(symbol: string, date: string, timeframe = '5MIN'): Observable<ReplayHistory> {
    return this.http.get<ReplayHistory>(`${this.apiBase}/replay/history/${symbol}`, {
      params: { date, timeframe }
    });
  }

  /** Load all stored sessions in lookback window — one call for Signal Intelligence backfill. */
  loadBulkHistory(symbol: string, days = 60, timeframe = '5MIN'): Observable<BulkReplayHistory> {
    return this.http.get<BulkReplayHistory>(`${this.apiBase}/replay/bulk/${symbol}`, {
      params: { days: String(days), timeframe }
    });
  }

  setHistory(history: ReplayHistory | null, startIndex?: number): void {
    this.stopPlayback();
    this.historySubject.next(history);
    if (!history?.sessionCandles.length) {
      this.indexSubject.next(-1);
    } else if (startIndex != null) {
      this.indexSubject.next(Math.max(0, Math.min(startIndex, history.sessionCandles.length - 1)));
    } else {
      this.indexSubject.next(0);
    }
    this.selectedEventSubject.next(null);
  }

  getHistory(): ReplayHistory | null {
    return this.historySubject.value;
  }

  getCurrentIndex(): number {
    return this.indexSubject.value;
  }

  selectEvent(event: ReplaySignalEvent | null): void {
    this.selectedEventSubject.next(event);
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speedSubject.next(speed);
    if (this.playingSubject.value) {
      this.startPlayback();
    }
  }

  play(): void {
    const history = this.historySubject.value;
    if (!history?.sessionCandles.length) return;
    if (this.indexSubject.value >= history.sessionCandles.length - 1) {
      this.indexSubject.next(-1);
    }
    this.startPlayback();
  }

  pause(): void {
    this.stopPlayback();
  }

  stepForward(): void {
    const history = this.historySubject.value;
    if (!history?.sessionCandles.length) return;
    this.stopPlayback();
    const next = Math.min(this.indexSubject.value + 1, history.sessionCandles.length - 1);
    this.indexSubject.next(next);
  }

  stepBack(): void {
    const history = this.historySubject.value;
    if (!history?.sessionCandles.length) return;
    this.stopPlayback();
    const next = Math.max(0, this.indexSubject.value - 1);
    this.indexSubject.next(next);
  }

  stepJump(delta: number): void {
    const history = this.historySubject.value;
    if (!history?.sessionCandles.length) return;
    this.stopPlayback();
    const next = Math.max(0, Math.min(this.indexSubject.value + delta, history.sessionCandles.length - 1));
    this.indexSubject.next(next);
  }

  seekToIndex(index: number): void {
    const history = this.historySubject.value;
    if (!history?.sessionCandles.length) return;
    this.indexSubject.next(Math.max(-1, Math.min(index, history.sessionCandles.length - 1)));
  }

  visibleTimeline(): ReplaySignalEvent[] {
    const history = this.historySubject.value;
    const idx = this.indexSubject.value;
    if (!history || idx < 0) return [];
    const cutoff = history.sessionCandles[idx]?.time;
    if (!cutoff) return [];
    const cutoffMs = new Date(cutoff).getTime();
    return history.timeline.filter(e => new Date(e.timestamp).getTime() <= cutoffMs);
  }

  visibleScoreHistory(): import('../models/replay.model').ReplayScorePoint[] {
    const history = this.historySubject.value;
    const idx = this.indexSubject.value;
    if (!history || idx < 0) return [];
    const cutoff = history.sessionCandles[idx]?.time;
    if (!cutoff) return [];
    const cutoffMs = new Date(cutoff).getTime();
    return history.scoreHistory.filter(e => new Date(e.timestamp).getTime() <= cutoffMs);
  }

  private startPlayback(): void {
    this.stopPlayback();
    this.playingSubject.next(true);
    const speed = this.speedSubject.value;
    const baseMs = speed >= 10 ? 300 : speed >= 5 ? 600 : speed >= 2 ? 900 : 1500;
    this.playTimer = setInterval(() => {
      const history = this.historySubject.value;
      if (!history?.sessionCandles.length) {
        this.stopPlayback();
        return;
      }
      const next = this.indexSubject.value + 1;
      if (next >= history.sessionCandles.length) {
        this.stopPlayback();
        return;
      }
      this.indexSubject.next(next);
    }, baseMs);
  }

  private stopPlayback(): void {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = undefined;
    }
    this.playingSubject.next(false);
  }
}
