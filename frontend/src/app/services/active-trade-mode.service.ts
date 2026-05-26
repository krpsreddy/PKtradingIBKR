import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ActiveTradeModeService {
  private readonly activeSubject = new BehaviorSubject<boolean>(false);

  readonly active$ = this.activeSubject.asObservable();

  isActive(): boolean {
    return this.activeSubject.value;
  }

  enable(): void {
    this.activeSubject.next(true);
  }

  disable(): void {
    this.activeSubject.next(false);
  }

  toggle(): void {
    this.activeSubject.next(!this.activeSubject.value);
  }
}
