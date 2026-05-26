import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { HttpRequestManagerService } from './network/http-request-manager.service';
import {
  CreateTradingSymbolRequest,
  TradingSymbol,
  UpdateTradingSymbolRequest
} from '../models/trading-symbol.model';

@Injectable({ providedIn: 'root' })
export class TradingSymbolService {
  private base = `${environment.apiUrl}/symbols`;
  private readonly lastViewAt = new Map<string, number>();
  private static readonly VIEW_DEBOUNCE_MS = 60_000;

  constructor(
    private http: HttpClient,
    private requestManager: HttpRequestManagerService
  ) {}

  /** Default fast path (enrich=false). Use SymbolEnrichmentQueueService for progressive enrich. */
  getSymbols(enrich = false): Observable<TradingSymbol[]> {
    const key = `symbols:list:${enrich}`;
    return this.requestManager.get(
      key,
      () => this.http.get<TradingSymbol[]>(`${this.base}?enrich=${enrich}`),
      {
        cacheKey: key,
        cacheBucket: enrich ? 'enrichSymbol' : 'symbolsList',
        cancelPrevious: true,
        timeoutMs: enrich ? 120_000 : 15_000
      }
    );
  }

  getSymbolsConfig(): Observable<TradingSymbol[]> {
    return this.http.get<TradingSymbol[]>(`${this.base}?enrich=false`);
  }

  createSymbol(request: CreateTradingSymbolRequest): Observable<TradingSymbol> {
    return this.http.post<TradingSymbol>(this.base, request);
  }

  updateSymbol(symbol: string, request: UpdateTradingSymbolRequest): Observable<TradingSymbol> {
    return this.http.put<TradingSymbol>(`${this.base}/${encodeURIComponent(symbol)}`, request);
  }

  deleteSymbol(symbol: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${encodeURIComponent(symbol)}`);
  }

  addToWatchlist(symbol: string): Observable<TradingSymbol> {
    return this.http.post<TradingSymbol>(`${this.base}/${encodeURIComponent(symbol)}/watchlist`, null);
  }

  removeFromWatchlist(symbol: string): Observable<TradingSymbol> {
    return this.http.delete<TradingSymbol>(`${this.base}/${encodeURIComponent(symbol)}/watchlist`);
  }

  toggleScan(symbol: string): Observable<TradingSymbol> {
    return this.http.post<TradingSymbol>(`${this.base}/${encodeURIComponent(symbol)}/toggle-scan`, null);
  }

  toggleLive(symbol: string): Observable<TradingSymbol> {
    return this.http.post<TradingSymbol>(`${this.base}/${encodeURIComponent(symbol)}/toggle-live`, null);
  }

  recordView(symbol: string): Observable<void> {
    const sym = symbol.toUpperCase();
    const now = Date.now();
    if (now - (this.lastViewAt.get(sym) ?? 0) < TradingSymbolService.VIEW_DEBOUNCE_MS) {
      return of(undefined);
    }
    this.lastViewAt.set(sym, now);
    return this.http
      .get(`${this.base}/${encodeURIComponent(sym)}/view`, { responseType: 'text' })
      .pipe(map(() => undefined));
  }

  reorder(symbols: string[]): Observable<TradingSymbol[]> {
    return this.http.post<TradingSymbol[]>(`${this.base}/reorder`, { symbols });
  }
}
