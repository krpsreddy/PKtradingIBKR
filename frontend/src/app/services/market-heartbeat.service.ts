import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MarketHeartbeat {
  pulses: string[];
  marketEmotion?: { label: string; description: string } | null;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class MarketHeartbeatService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getHeartbeat(): Observable<MarketHeartbeat> {
    return this.http.get<MarketHeartbeat>(`${this.base}/probabilistic/heartbeat`)
      .pipe(catchError(() => of({ pulses: ['Monitoring session'], timestamp: Date.now() })));
  }
}
