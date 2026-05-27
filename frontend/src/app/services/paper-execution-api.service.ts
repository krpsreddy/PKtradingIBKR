import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ExecutionAnalytics,
  ExecutionMonitorSnapshot,
  PaperExecutionMode,
  PaperExecutionRecord,
  PaperExecutionStatusDto,
  PaperProbeRequest
} from '../models/paper-execution.model';

@Injectable({ providedIn: 'root' })
export class PaperExecutionApiService {
  private readonly base = `${environment.apiUrl}/paper-execution`;

  constructor(private http: HttpClient) {}

  status(): Observable<PaperExecutionStatusDto> {
    return this.http.get<PaperExecutionStatusDto>(`${this.base}/status`);
  }

  setMode(mode: PaperExecutionMode): Observable<PaperExecutionStatusDto> {
    return this.http.put<PaperExecutionStatusDto>(`${this.base}/mode`, { mode });
  }

  submitProbe(req: PaperProbeRequest): Observable<PaperExecutionRecord> {
    return this.http.post<PaperExecutionRecord>(`${this.base}/probe`, req);
  }

  monitor(): Observable<ExecutionMonitorSnapshot> {
    return this.http.get<ExecutionMonitorSnapshot>(`${this.base}/monitor`);
  }

  manualClose(id: number, exitPrice?: number): Observable<PaperExecutionRecord> {
    return this.http.post<PaperExecutionRecord>(`${this.base}/${id}/close`, { exitPrice });
  }

  analytics(): Observable<ExecutionAnalytics> {
    return this.http.get<ExecutionAnalytics>(`${this.base}/analytics`);
  }
}
