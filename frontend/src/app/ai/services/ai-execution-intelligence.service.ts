import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  AiExecutionResponse,
  AiProviderStatus,
  CoachingResponse,
  EMPTY_AI_EXECUTION,
  EMPTY_COACHING
} from '../models/ai.models';
import { HttpAiProvider } from '../providers/http-ai-provider';
import { formatAiCompactLine } from '../utils/ai-compact-line.util';

@Injectable({ providedIn: 'root' })
export class AiExecutionIntelligenceService {
  private readonly TTL_MS = 12_000;
  private cache = new Map<string, { ts: number; data: AiExecutionResponse }>();
  private coachingCache = new Map<string, { ts: number; data: CoachingResponse }>();

  private executionSubject = new BehaviorSubject<AiExecutionResponse | null>(null);
  readonly execution$ = this.executionSubject.asObservable();

  constructor(private httpProvider: HttpAiProvider) {}

  refreshStatus(): Promise<AiProviderStatus> {
    return this.httpProvider.getStatus();
  }

  async analyzeExecution(symbol: string, signalType: string): Promise<AiExecutionResponse> {
    const key = `${symbol}:${signalType}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.ts < this.TTL_MS) {
      this.executionSubject.next(hit.data);
      return hit.data;
    }
    try {
      const data = await this.httpProvider.analyzeExecution(symbol, signalType);
      const normalized = { ...data, compactLine: formatAiCompactLine(data) };
      this.cache.set(key, { ts: Date.now(), data: normalized });
      this.executionSubject.next(normalized);
      return normalized;
    } catch {
      this.executionSubject.next(EMPTY_AI_EXECUTION);
      return EMPTY_AI_EXECUTION;
    }
  }

  analyzeExecution$(symbol: string, signalType: string): Observable<AiExecutionResponse> {
    return new Observable(sub => {
      this.analyzeExecution(symbol, signalType)
        .then(d => { sub.next(d); sub.complete(); })
        .catch(() => { sub.next(EMPTY_AI_EXECUTION); sub.complete(); });
    });
  }

  async generateCoaching(symbol: string): Promise<CoachingResponse> {
    const hit = this.coachingCache.get(symbol);
    if (hit && Date.now() - hit.ts < this.TTL_MS * 2) return hit.data;
    try {
      const data = await this.httpProvider.generateCoaching(symbol);
      this.coachingCache.set(symbol, { ts: Date.now(), data });
      return data;
    } catch {
      return EMPTY_COACHING;
    }
  }

  compactLine(response: AiExecutionResponse | null): string {
    return formatAiCompactLine(response);
  }
}
