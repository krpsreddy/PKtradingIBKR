import { Injectable } from '@angular/core';
import { SignalSnapshot } from '../../../models/signal-intelligence.model';
import { AnalyticsStorageApiService } from './analytics-storage-api.service';

/** Load evaluated signals from persistent backend storage. */
@Injectable({ providedIn: 'root' })
export class PersistentEvaluatedSignalService {

  constructor(private api: AnalyticsStorageApiService) {}

  async loadAll(options: {
    symbol?: string;
    fromTs?: number;
    toTs?: number;
    pageSize?: number;
  } = {}): Promise<SignalSnapshot[]> {
    const pageSize = options.pageSize ?? 500;
    const out: SignalSnapshot[] = [];
    let page = 0;
    let total = Infinity;

    while (out.length < total) {
      const res = await this.api.fetchSnapshots({
        symbol: options.symbol,
        fromTs: options.fromTs,
        toTs: options.toTs,
        page,
        size: pageSize
      });
      if (!res?.signals?.length) break;
      out.push(...res.signals);
      total = res.totalElements;
      page++;
      if (page > 200) break;
    }
    return out;
  }

  async loadIncremental(sinceTs: number, symbol?: string): Promise<SignalSnapshot[]> {
    return this.loadAll({ symbol, fromTs: sinceTs });
  }
}
