import { Injectable } from '@angular/core';
import { Observable, defer, finalize, shareReplay, tap, timeout } from 'rxjs';
import { ApiCacheService } from './api-cache.service';
import { NetworkCacheBucket } from './network-cache.config';
import { NetworkDiagnosticsService } from './network-diagnostics.service';

export interface ManagedRequestOptions {
  cacheKey?: string;
  cacheBucket?: NetworkCacheBucket;
  forceRefresh?: boolean;
  timeoutMs?: number;
  cancelPrevious?: boolean;
}

/**
 * Central HTTP orchestration: in-flight deduplication, TTL cache, stale request cancellation.
 */
@Injectable({ providedIn: 'root' })
export class HttpRequestManagerService {
  private readonly inFlight = new Map<string, Observable<unknown>>();
  private readonly abortControllers = new Map<string, AbortController>();

  constructor(
    private cache: ApiCacheService,
    private diagnostics: NetworkDiagnosticsService
  ) {}

  get<T>(
    key: string,
    factory: (signal: AbortSignal) => Observable<T>,
    options: ManagedRequestOptions = {}
  ): Observable<T> {
    const { cacheKey, cacheBucket, forceRefresh, timeoutMs = 30_000, cancelPrevious = true } = options;

    if (cacheKey && cacheBucket && !forceRefresh) {
      const hit = this.cache.get<T>(cacheKey, cacheBucket);
      if (hit != null) {
        this.diagnostics.recordDeduped();
        this.diagnostics.setCacheHitRate(this.cache.stats().hitRate);
        return new Observable(sub => {
          sub.next(hit);
          sub.complete();
        });
      }
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      this.diagnostics.recordDeduped();
      return existing as Observable<T>;
    }

    const requestKey = `${key}:${Date.now()}`;
    const obs = defer(() => {
      if (cancelPrevious) {
        const prev = this.abortControllers.get(key);
        if (prev) {
          prev.abort();
          this.diagnostics.recordDroppedStale();
        }
      }
      const controller = new AbortController();
      this.abortControllers.set(key, controller);

      this.diagnostics.recordStart(requestKey, 'GET', key);
      return factory(controller.signal).pipe(
        timeout(timeoutMs),
        tap({
          next: value => {
            if (cacheKey && cacheBucket) {
              this.cache.set(cacheKey, value, cacheBucket);
            }
            this.diagnostics.setCacheHitRate(this.cache.stats().hitRate);
          },
          error: () => this.diagnostics.recordEnd(requestKey, 'error'),
          complete: () => this.diagnostics.recordEnd(requestKey, 'ok')
        }),
        finalize(() => {
          this.abortControllers.delete(key);
          this.inFlight.delete(key);
        })
      );
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));

    this.inFlight.set(key, obs);
    return obs;
  }

  invalidate(keyPrefix: string): void {
    this.cache.invalidate(keyPrefix);
    for (const k of [...this.inFlight.keys()]) {
      if (k.startsWith(keyPrefix)) this.inFlight.delete(k);
    }
  }
}
