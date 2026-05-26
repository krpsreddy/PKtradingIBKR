import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SystemStatus } from '../models/system-status.model';

@Injectable({ providedIn: 'root' })
export class SystemStatusService {
  private readonly url = `${environment.apiUrl}/system/status`;

  constructor(private http: HttpClient) {}

  getStatus(): Observable<SystemStatus> {
    return this.http.get<SystemStatus>(this.url);
  }
}
