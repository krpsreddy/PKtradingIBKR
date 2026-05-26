import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ExecutionSnapshot, EmergingSetup, TradeJournalEntry } from '../models/refinement.model';

@Injectable({ providedIn: 'root' })
export class ExecutionApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getExecutionSnapshot(symbol: string): Observable<ExecutionSnapshot> {
    return this.http.get<ExecutionSnapshot>(`${this.base}/execution/${symbol}`);
  }

  getEmergingSetups(): Observable<EmergingSetup[]> {
    return this.http.get<EmergingSetup[]>(`${this.base}/setups/emerging`);
  }
}

@Injectable({ providedIn: 'root' })
export class TradeJournalService {
  private base = `${environment.apiUrl}/journal`;

  constructor(private http: HttpClient) {}

  list(symbol?: string, setupType?: string): Observable<TradeJournalEntry[]> {
    const params: string[] = [];
    if (symbol) params.push(`symbol=${encodeURIComponent(symbol)}`);
    if (setupType) params.push(`setupType=${encodeURIComponent(setupType)}`);
    const q = params.length ? `?${params.join('&')}` : '';
    return this.http.get<TradeJournalEntry[]>(`${this.base}${q}`);
  }

  create(entry: TradeJournalEntry): Observable<TradeJournalEntry> {
    return this.http.post<TradeJournalEntry>(this.base, entry);
  }

  update(id: number, entry: TradeJournalEntry): Observable<TradeJournalEntry> {
    return this.http.put<TradeJournalEntry>(`${this.base}/${id}`, entry);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
