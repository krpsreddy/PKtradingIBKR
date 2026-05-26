import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { ChartTimeframe } from '../utils/chart-range.util';

export type ChartAnchorState = 'LIVE_LOCKED' | 'HISTORY_REVIEW' | 'REPLAY_MODE';

const TF_KEY = 'chartTimeframe';

@Injectable({ providedIn: 'root' })
export class ChartLiveStateService {
  private readonly stateSubject = new BehaviorSubject<ChartAnchorState>('LIVE_LOCKED');
  private readonly returnSubject = new Subject<void>();
  private readonly timeframeSubject = new BehaviorSubject<ChartTimeframe>(
    (localStorage.getItem(TF_KEY) as ChartTimeframe) || 'TODAY'
  );

  readonly anchorState$ = this.stateSubject.asObservable();
  readonly returnToLiveRequested$ = this.returnSubject.asObservable();
  readonly chartTimeframe$ = this.timeframeSubject.asObservable();

  get anchorState(): ChartAnchorState {
    return this.stateSubject.value;
  }

  syncFromChart(chartMode: 'LIVE' | 'REPLAY', followLatest: boolean): void {
    if (chartMode === 'REPLAY') {
      this.stateSubject.next('REPLAY_MODE');
    } else if (followLatest) {
      this.stateSubject.next('LIVE_LOCKED');
    } else {
      this.stateSubject.next('HISTORY_REVIEW');
    }
  }

  setReplayMode(): void {
    this.stateSubject.next('REPLAY_MODE');
  }

  setLiveLocked(): void {
    this.stateSubject.next('LIVE_LOCKED');
  }

  returnToLive(): void {
    this.stateSubject.next('LIVE_LOCKED');
    this.returnSubject.next();
  }

  isHistoryReview(): boolean {
    return this.stateSubject.value === 'HISTORY_REVIEW';
  }

  chartTimeframe(): ChartTimeframe {
    return this.timeframeSubject.value;
  }

  setChartTimeframe(tf: ChartTimeframe): void {
    this.timeframeSubject.next(tf);
    localStorage.setItem(TF_KEY, tf);
  }
}
