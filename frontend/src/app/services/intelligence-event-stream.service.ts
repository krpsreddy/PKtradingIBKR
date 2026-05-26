import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IntelligenceEvent } from '../models/cognition.model';
import { CognitionService } from './cognition.service';

/** Event-driven intelligence stream — websocket-ready via CognitionService poll patches. */
@Injectable({ providedIn: 'root' })
export class IntelligenceEventStreamService {
  private events$ = new BehaviorSubject<IntelligenceEvent[]>([]);

  constructor(private cognition: CognitionService) {
    this.cognition.cognition$.subscribe(snap => {
      if (snap.events?.length) this.events$.next(snap.events);
    });
  }

  stream(): Observable<IntelligenceEvent[]> {
    return this.events$.asObservable();
  }

  push(events: IntelligenceEvent[]): void {
    this.events$.next(events);
  }
}
