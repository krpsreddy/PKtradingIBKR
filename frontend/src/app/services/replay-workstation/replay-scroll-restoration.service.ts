import { Injectable } from '@angular/core';

/** Preserve panel scroll positions across replay navigation. */
@Injectable({ providedIn: 'root' })
export class ReplayScrollRestorationService {
  private positions = new Map<string, number>();

  save(key: string, scrollTop: number): void {
    this.positions.set(key, scrollTop);
  }

  restore(key: string): number {
    return this.positions.get(key) ?? 0;
  }

  clear(): void {
    this.positions.clear();
  }
}
