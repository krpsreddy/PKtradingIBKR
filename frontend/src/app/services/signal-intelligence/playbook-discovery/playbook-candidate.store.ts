import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  PLAYBOOK_CANDIDATES_STORAGE_KEY,
  PlaybookCandidate,
  PlaybookEvolutionEvent,
  PlaybookPromotionState
} from './playbook-candidate.models';

interface StoredPlaybookState {
  candidates: PlaybookCandidate[];
  events: PlaybookEvolutionEvent[];
}

/** Persists playbook candidates + human promotion workflow only. */
@Injectable({ providedIn: 'root' })
export class PlaybookCandidateStore {
  private candidates: PlaybookCandidate[] = [];
  private evolutionEvents: PlaybookEvolutionEvent[] = [];
  private readonly revisionSubject = new BehaviorSubject<number>(0);

  readonly revision$ = this.revisionSubject.asObservable();

  constructor() {
    this.load();
  }

  revision(): number {
    return this.revisionSubject.value;
  }

  all(): PlaybookCandidate[] {
    return [...this.candidates];
  }

  evolutionTimeline(): PlaybookEvolutionEvent[] {
    return [...this.evolutionEvents].sort((a, b) => b.at - a.at);
  }

  get(id: string): PlaybookCandidate | undefined {
    return this.candidates.find(c => c.id === id);
  }

  saveDiscovery(candidates: PlaybookCandidate[], newEvents: PlaybookEvolutionEvent[]): void {
    this.candidates = candidates;
    this.evolutionEvents = [...this.evolutionEvents, ...newEvents].slice(-200);
    this.persist();
    this.revisionSubject.next(this.revisionSubject.value + 1);
  }

  /** Human-only promotion — never auto-called by discovery engines. */
  promote(id: string, state: PlaybookPromotionState): PlaybookCandidate | null {
    const idx = this.candidates.findIndex(c => c.id === id);
    if (idx < 0) return null;
    const valid = validTransition(this.candidates[idx].promotionState, state);
    if (!valid) return null;
    this.candidates[idx] = { ...this.candidates[idx], promotionState: state, lastUpdated: Date.now() };
    this.persist();
    this.revisionSubject.next(this.revisionSubject.value + 1);
    return this.candidates[idx];
  }

  /** Import server-persisted candidates without triggering rediscovery. */
  importFromServer(candidates: PlaybookCandidate[]): void {
    if (!candidates.length) return;
    const byId = new Map(this.candidates.map(c => [c.id, c]));
    for (const c of candidates) {
      byId.set(c.id, { ...c, advisoryOnly: true as const });
    }
    this.candidates = [...byId.values()];
    this.persist();
    this.revisionSubject.next(this.revisionSubject.value + 1);
  }

  private persist(): void {
    const payload: StoredPlaybookState = { candidates: this.candidates, events: this.evolutionEvents };
    try {
      localStorage.setItem(PLAYBOOK_CANDIDATES_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // quota — keep in memory
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(PLAYBOOK_CANDIDATES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredPlaybookState;
      this.candidates = parsed.candidates ?? [];
      this.evolutionEvents = parsed.events ?? [];
    } catch {
      this.candidates = [];
      this.evolutionEvents = [];
    }
  }
}

function validTransition(from: PlaybookPromotionState, to: PlaybookPromotionState): boolean {
  const order: PlaybookPromotionState[] = ['DISCOVERED', 'REVIEWED', 'APPROVED', 'ACTIVE_PLAYBOOK'];
  const fi = order.indexOf(from);
  const ti = order.indexOf(to);
  return ti === fi + 1 || to === 'DISCOVERED';
}
