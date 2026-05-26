import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AnalyticsQueryApiService } from './analytics-query-api.service';
import { AnalyticsQueryFilters, AnalyticsWorkbench } from './analytics-query.models';
import { AnalyticsSyncService } from '../signal-intelligence/persistent-analytics/analytics-sync.service';

export interface AnalyticsQueryState {
  loading: boolean;
  error: string | null;
  filters: AnalyticsQueryFilters;
  workbench: AnalyticsWorkbench | null;
  dbSnapshotCount: number;
}

const DEFAULT_STATE: AnalyticsQueryState = {
  loading: false,
  error: null,
  filters: {},
  workbench: null,
  dbSnapshotCount: 0
};

@Injectable({ providedIn: 'root' })
export class AnalyticsQuerySynthesisService {
  private readonly stateSubject = new BehaviorSubject<AnalyticsQueryState>({ ...DEFAULT_STATE });
  readonly state$ = this.stateSubject.asObservable();

  constructor(
    private api: AnalyticsQueryApiService,
    private analyticsSync: AnalyticsSyncService
  ) {}

  snapshot(): AnalyticsQueryState {
    return this.stateSubject.value;
  }

  async load(filters?: AnalyticsQueryFilters): Promise<void> {
    const nextFilters = filters ?? this.snapshot().filters;
    this.patch({ loading: true, error: null, filters: nextFilters });

    let dbCount = await this.api.fetchDbCount();
    if (dbCount === 0) {
      await this.analyticsSync.ensureServerHasSnapshots({ symbol: nextFilters.symbol });
      dbCount = await this.api.fetchDbCount();
    }

    const workbench = await this.api.fetchWorkbench(nextFilters);

    if (!workbench) {
      this.patch({
        loading: false,
        error: 'Analytics query unavailable — check backend / PostgreSQL connection',
        dbSnapshotCount: dbCount
      });
      return;
    }

    const error = workbench.totalRows === 0 && dbCount === 0
      ? 'No evaluated snapshots in PostgreSQL — run history hydration first'
      : workbench.totalRows === 0
        ? 'No rows match current filters'
        : null;

    this.patch({ loading: false, error, workbench, dbSnapshotCount: dbCount });
  }

  setSymbol(symbol: string): void {
    void this.load({ ...this.snapshot().filters, symbol: symbol.toUpperCase() });
  }

  setFilters(partial: AnalyticsQueryFilters): void {
    void this.load({ ...this.snapshot().filters, ...partial });
  }

  private patch(partial: Partial<AnalyticsQueryState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
