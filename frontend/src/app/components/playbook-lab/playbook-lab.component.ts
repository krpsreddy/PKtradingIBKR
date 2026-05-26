import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PlaybookDiscoveryService } from '../../services/signal-intelligence/playbook-discovery/playbook-discovery.service';
import { PlaybookCandidateStore } from '../../services/signal-intelligence/playbook-discovery/playbook-candidate.store';
import { SymbolHistoryHydrationStore } from '../../ai/services/hydration/symbol-history-hydration.store';
import {
  PlaybookCandidate,
  PlaybookDiscoverySnapshot,
  PlaybookEvolutionEvent,
  PlaybookPromotionState
} from '../../services/signal-intelligence/playbook-discovery/playbook-candidate.models';
import { AdaptiveCalibrationSynthesisService } from '../../services/signal-intelligence/adaptive-calibration/adaptive-calibration-synthesis.service';
import { PlaybookCalibrationProfile } from '../../services/signal-intelligence/adaptive-calibration/adaptive-calibration.models';

/** Phase 139 — Playbook Lab: human review of discovered candidate playbooks. */
@Component({
  selector: 'app-playbook-lab',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './playbook-lab.component.html',
  styleUrl: './playbook-lab.component.scss'
})
export class PlaybookLabComponent implements OnInit, OnDestroy {
  snapshot: PlaybookDiscoverySnapshot | null = null;
  timeline: PlaybookEvolutionEvent[] = [];
  selected: PlaybookCandidate | null = null;
  loading = false;
  calibrationProfiles: PlaybookCalibrationProfile[] = [];

  private sub?: Subscription;
  private storeSub?: Subscription;
  private calSub?: Subscription;

  constructor(
    private discovery: PlaybookDiscoveryService,
    private candidateStore: PlaybookCandidateStore,
    private hydrationStore: SymbolHistoryHydrationStore,
    private calibration: AdaptiveCalibrationSynthesisService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.snapshot = this.discovery.refresh();
    this.timeline = this.candidateStore.evolutionTimeline();
    this.selected = this.snapshot.candidates[0] ?? null;
    this.calibrationProfiles = this.calibration.playbookProfiles();
    this.loading = false;

    this.sub = this.discovery.snapshot$.subscribe(s => {
      this.snapshot = s;
      if (s && !this.selected) this.selected = s.candidates[0] ?? null;
      this.cdr.markForCheck();
    });
    this.calSub = this.calibration.report$.subscribe(() => {
      this.calibrationProfiles = this.calibration.playbookProfiles();
      this.cdr.markForCheck();
    });
    this.storeSub = this.candidateStore.revision$.subscribe(() => {
      this.timeline = this.candidateStore.evolutionTimeline();
      if (this.selected) {
        this.selected = this.candidateStore.get(this.selected.id) ?? this.selected;
      }
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.storeSub?.unsubscribe();
    this.calSub?.unsubscribe();
  }

  refresh(): void {
    this.loading = true;
    this.snapshot = this.discovery.refresh();
    this.timeline = this.candidateStore.evolutionTimeline();
    this.selected = this.snapshot.candidates[0] ?? null;
    this.loading = false;
    this.cdr.markForCheck();
  }

  selectCandidate(c: PlaybookCandidate): void {
    this.selected = c;
    this.cdr.markForCheck();
  }

  promote(next: PlaybookPromotionState): void {
    if (!this.selected) return;
    if (this.discovery.promoteCandidate(this.selected.id, next)) {
      this.selected = this.candidateStore.get(this.selected.id) ?? this.selected;
      this.snapshot = this.discovery.snapshot();
      this.cdr.markForCheck();
    }
  }

  nextPromotionState(): PlaybookPromotionState | null {
    if (!this.selected) return null;
    switch (this.selected.promotionState) {
      case 'DISCOVERED': return 'REVIEWED';
      case 'REVIEWED': return 'APPROVED';
      case 'APPROVED': return 'ACTIVE_PLAYBOOK';
      default: return null;
    }
  }

  promotionLabel(state: PlaybookPromotionState): string {
    return state.replace(/_/g, ' ');
  }

  simFor(id: string) {
    return this.snapshot?.simulations.find(s => s.candidateId === id) ?? null;
  }

  formatR(v: number): string {
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
  }

  confidenceClass(c: string): string {
    return c.toLowerCase();
  }

  evolutionClass(e: string): string {
    return e.toLowerCase();
  }

  /** True when backend/local hydration metadata shows prior 60D load. */
  hasHydratedHistory(): boolean {
    return this.hydrationStore.all().some(s =>
      s.hydrationStatus === 'READY' || s.hydrationStatus === 'PARTIAL' || s.loadedDays >= 10
    );
  }
}
