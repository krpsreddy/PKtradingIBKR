import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  DailyEdgeDiscoveryReport,
  EdgeDiscoveryAiSummary,
  EdgeDiscoveryCompressedPayload
} from './edge-discovery.models';
import { synthesizeEdgeDiscovery } from './execution-edge-gate.service';

const AI_TIMEOUT_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class EdgeDiscoveryAiSynthesisService {
  private base = `${environment.apiUrl}/ai`;

  constructor(private http: HttpClient) {}

  /** AI summarizes compressed analytics only — deterministic fallback on failure. */
  async synthesize(
    report: DailyEdgeDiscoveryReport,
    payload: EdgeDiscoveryCompressedPayload
  ): Promise<EdgeDiscoveryAiSummary> {
    const local = synthesizeEdgeDiscovery(report);

    if (report.discovery.totalEvaluated < 10) {
      return local;
    }

    try {
      return await firstValueFrom(
        this.http.post<EdgeDiscoveryAiSummary>(`${this.base}/edge-discovery`, payload).pipe(
          timeout(AI_TIMEOUT_MS),
          catchError(() => of(local))
        )
      );
    } catch {
      return local;
    }
  }
}
