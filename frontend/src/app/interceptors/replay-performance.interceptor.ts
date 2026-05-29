import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { ReplayPerformanceDiagnosticsService } from '../services/replay-performance/replay-performance-diagnostics.service';

function isReplayUrl(url: string): boolean {
  return url.includes('/replay') || url.includes('/replay-cache') || url.includes('/execution-review');
}

function extractSymbol(url: string): string | undefined {
  const m = url.match(/\/(replay|replay-cache)\/[^/]+\/([A-Z0-9.^-]+)/i);
  return m?.[2]?.toUpperCase();
}

/** Phase 193 — log replay-related HTTP timing and payload sizes. */
export const replayPerformanceInterceptor: HttpInterceptorFn = (req, next) => {
  const diag = inject(ReplayPerformanceDiagnosticsService);
  if (!isReplayUrl(req.url)) {
    return next(req);
  }
  const t0 = performance.now();
  return next(req).pipe(
    tap({
      next: event => {
        if (event instanceof HttpResponse) {
          const body = event.body;
          let bytes = 0;
          try {
            bytes = body != null ? new TextEncoder().encode(JSON.stringify(body)).length : 0;
          } catch {
            bytes = 0;
          }
          diag.recordRequest({
            endpoint: req.urlWithParams,
            method: req.method,
            symbol: extractSymbol(req.url),
            durationMs: Math.round(performance.now() - t0),
            payloadBytes: bytes
          });
        }
      },
      error: () => {
        diag.recordRequest({
          endpoint: req.urlWithParams,
          method: req.method,
          symbol: extractSymbol(req.url),
          durationMs: Math.round(performance.now() - t0),
          payloadBytes: 0
        });
      }
    })
  );
};
