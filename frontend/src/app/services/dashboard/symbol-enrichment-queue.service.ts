import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TradingSymbol } from '../../models/trading-symbol.model';
import { HttpRequestManagerService } from '../network/http-request-manager.service';
import { DashboardStateStoreService } from './dashboard-state-store.service';

const MAX_CONCURRENT = 3;
const ENRICH_FAIL_BACKOFF_MS = 60_000;

/** Progressive symbol enrichment — visible symbols first, max 3 parallel jobs. */
@Injectable({ providedIn: 'root' })
export class SymbolEnrichmentQueueService {
  private readonly base = `${environment.apiUrl}/symbols`;
  private queue: string[] = [];
  private inFlight = 0;
  private readonly enriched = new Set<string>();
  private readonly failedUntil = new Map<string, number>();
  private readonly doneSubject = new Subject<TradingSymbol[]>();
  readonly enrichedBatch$ = this.doneSubject.asObservable();

  constructor(
    private http: HttpClient,
    private requestManager: HttpRequestManagerService,
    private store: DashboardStateStoreService
  ) {}

  /** Fast path: base symbol list without enrichment. */
  loadBaseSymbols(): Observable<TradingSymbol[]> {
    return this.requestManager.get(
      'symbols:base',
      () => this.http.get<TradingSymbol[]>(`${this.base}?enrich=false`),
      { cacheKey: 'symbols:base', cacheBucket: 'symbolsList', cancelPrevious: true }
    );
  }

  /** Phase 192 — explicit on-demand enrich (replay/review symbol), never full watchlist. */
  scheduleOnDemand(symbols: string[], visible: string[] = []): void {
    this.scheduleInternal(symbols, visible, true);
  }

  /** Live runtime only — progressive watchlist enrichment. */
  schedule(symbols: string[], visible: string[] = []): void {
    this.scheduleInternal(symbols, visible, false);
  }

  private scheduleInternal(symbols: string[], visible: string[] = [], onDemand = false): void {
    const now = Date.now();
    const ordered = [
      ...visible.map(s => s.toUpperCase()),
      ...symbols.map(s => s.toUpperCase())
    ];
    const uniq = [...new Set(ordered)].filter(s => {
      if (this.enriched.has(s)) return false;
      return (this.failedUntil.get(s) ?? 0) <= now;
    });
    if (!uniq.length) return;
    if (onDemand) {
      this.queue.push(...uniq);
    } else {
      this.queue = uniq;
    }
    this.pump();
  }

  invalidate(symbol?: string): void {
    if (symbol) {
      const sym = symbol.toUpperCase();
      this.enriched.delete(sym);
      this.failedUntil.delete(sym);
      this.requestManager.invalidate(`symbols:enrich:${sym}`);
    } else {
      this.enriched.clear();
      this.failedUntil.clear();
      this.requestManager.invalidate('symbols:enrich');
    }
  }

  private pump(): void {
    while (this.inFlight < MAX_CONCURRENT && this.queue.length > 0) {
      const batch = this.queue.splice(0, Math.min(8, this.queue.length));
      this.inFlight++;
      this.enrichBatch(batch).subscribe({
        next: rows => {
          this.store.mergeEnrichedSymbols(rows);
          for (const s of batch) {
            this.enriched.add(s);
            this.failedUntil.delete(s);
          }
          this.doneSubject.next(rows);
        },
        complete: () => {
          this.inFlight--;
          this.pump();
        },
        error: () => {
          const until = Date.now() + ENRICH_FAIL_BACKOFF_MS;
          for (const s of batch) this.failedUntil.set(s, until);
          this.inFlight--;
          this.pump();
        }
      });
    }
  }

  private enrichBatch(symbols: string[]): Observable<TradingSymbol[]> {
    const key = `symbols:enrich:${symbols.join(',')}`;
    const params = new HttpParams().set('symbols', symbols.join(','));
    return this.requestManager.get(
      key,
      () =>
        this.http.get<TradingSymbol[]>(`${this.base}/enrich`, { params }).pipe(
          tap(rows => rows.forEach(r => this.enriched.add(r.symbol))),
          catchError(() => {
            const until = Date.now() + ENRICH_FAIL_BACKOFF_MS;
            symbols.forEach(s => this.failedUntil.set(s, until));
            return of([]);
          })
        ),
      {
        cacheKey: key,
        cacheBucket: 'enrichSymbol',
        cancelPrevious: false,
        timeoutMs: 45_000
      }
    );
  }
}
