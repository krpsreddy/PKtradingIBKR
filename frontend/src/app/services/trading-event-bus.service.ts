import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ActiveSignal } from '../models/workspace.model';
import { BehaviorInsight, MarketMemory, TraderEdge } from '../models/analytics.model';
import { CognitionSnapshot } from '../models/cognition.model';
import { MarketTrend } from '../models/workspace.model';

export interface DashboardSnapshot {
  activeSignals: ActiveSignal[];
  marketTrend: MarketTrend | null;
  traderEdge: TraderEdge | null;
  behavior: BehaviorInsight[];
  memory: MarketMemory | null;
  cognition: CognitionSnapshot | null;
  ts: number;
}

/** Central reactive stream hub — websocket-ready; polls publish incremental snapshots here. */
@Injectable({ providedIn: 'root' })
export class TradingEventBusService {
  private snapshot$ = new BehaviorSubject<DashboardSnapshot>({
    activeSignals: [],
    marketTrend: null,
    traderEdge: null,
    behavior: [],
    memory: null,
    cognition: null,
    ts: 0
  });

  readonly dashboard$: Observable<DashboardSnapshot> = this.snapshot$.asObservable();

  publish(partial: Partial<DashboardSnapshot>): void {
    this.snapshot$.next({ ...this.snapshot$.value, ...partial, ts: Date.now() });
  }

  patchActiveSignals(activeSignals: ActiveSignal[]): void {
    this.publish({ activeSignals });
  }

  patchAnalytics(traderEdge: TraderEdge | null, behavior: BehaviorInsight[], memory: MarketMemory | null): void {
    this.publish({ traderEdge, behavior, memory });
  }

  patchMarketTrend(marketTrend: MarketTrend | null): void {
    this.publish({ marketTrend });
  }

  patchCognition(cognition: CognitionSnapshot | null): void {
    this.publish({ cognition });
  }
}
