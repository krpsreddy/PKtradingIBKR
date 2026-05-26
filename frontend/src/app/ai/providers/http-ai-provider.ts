import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AiExecutionResponse,
  AiProviderStatus,
  CoachingResponse,
  EMPTY_AI_EXECUTION,
  EMPTY_COACHING,
  OpenStructureResponse
} from '../models/ai.models';
import { AiProvider } from './ai-provider';

@Injectable({ providedIn: 'root' })
export class HttpAiProvider implements AiProvider {
  readonly id = 'http';
  private base = `${environment.apiUrl}/ai`;

  constructor(private http: HttpClient) {}

  async isAvailable(): Promise<boolean> {
    const status = await this.getStatus();
    return status.enabled;
  }

  getStatus(): Promise<AiProviderStatus> {
    return firstValueFrom(
      this.http.get<AiProviderStatus>(`${this.base}/status`).pipe(
        catchError(() => of({
          enabled: false,
          configuredProvider: 'noop',
          activeProvider: 'noop',
          providerAvailable: false,
          model: '',
          message: 'AI status unavailable'
        }))
      )
    );
  }

  analyzeExecution(symbol: string, signalType: string): Promise<AiExecutionResponse> {
    return firstValueFrom(
      this.http.get<AiExecutionResponse>(`${this.base}/execution/analyze`, {
        params: { symbol, signalType: signalType || 'WATCH' }
      }).pipe(catchError(() => of(EMPTY_AI_EXECUTION)))
    );
  }

  analyzeOpenStructure(symbol: string): Promise<OpenStructureResponse> {
    return firstValueFrom(
      this.http.get<OpenStructureResponse>(`${this.base}/open-structure/analyze`, {
        params: { symbol }
      }).pipe(catchError(() => of({
        provider: 'noop',
        latencyMs: 0,
        available: false,
        fallbackUsed: true,
        classification: '',
        structureAssessment: '',
        entryTimingGuidance: '',
        warnings: []
      })))
    );
  }

  generateCoaching(symbol: string): Promise<CoachingResponse> {
    return firstValueFrom(
      this.http.get<CoachingResponse>(`${this.base}/coaching/generate`, {
        params: { symbol }
      }).pipe(catchError(() => of(EMPTY_COACHING)))
    );
  }
}
