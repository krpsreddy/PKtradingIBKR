import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { NgClass } from '@angular/common';
import { ConfidenceBadgeComponent } from '../confidence-badge/confidence-badge.component';
import { Playbook } from '../../models/analytics.model';
import { resolveAutonomousRegime } from '../../utils/autonomous-terminology.util';

@Component({
  selector: 'app-playbook-browser',
  standalone: true,
  imports: [ConfidenceBadgeComponent, NgClass],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './playbook-browser.component.html',
  styleUrl: './playbook-browser.component.scss'
})
export class PlaybookBrowserComponent implements OnChanges {
  @Input() playbooks: Playbook[] = [];
  @Input() activeSignalType: string | null = null;
  @Input() flyoutMode = true;
  selectedId: string | null = null;
  expanded = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnChanges(): void {
    if (this.activeSignalType && this.playbooks.some(p => this.matchesSignal(p))) {
      const match = this.playbooks.find(p => this.matchesSignal(p));
      if (match) {
        this.selectedId = match.id;
        this.expanded = true;
      }
    }
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
    this.cdr.markForCheck();
  }

  activePlaybook(): Playbook | null {
    if (!this.playbooks.length) return null;
    const match = this.playbooks.find(p => this.matchesSignal(p));
    if (match) return match;
    return this.active();
  }

  select(id: string): void {
    this.selectedId = id;
    this.cdr.markForCheck();
  }

  active(): Playbook | null {
    if (!this.playbooks.length) return null;
    const id = this.selectedId ?? this.playbooks[0].id;
    return this.playbooks.find(p => p.id === id) ?? this.playbooks[0];
  }

  winRatePercent(pb: Playbook | { winRate?: number | null; historicalWinRate?: number | null }): number {
    const r = 'historicalWinRate' in pb ? pb.historicalWinRate : pb.winRate;
    if (r == null) return 0;
    return r <= 1 ? Math.round(r * 100) : Math.round(r);
  }

  regimeClass(label: string): string {
    return 'label-' + (label ?? 'good').toLowerCase();
  }

  contextClass(status: string): string {
    return 'ctx-' + status.toLowerCase();
  }

  matchesSignal(pb: Playbook): boolean {
    if (!this.activeSignalType) return false;
    const regime = resolveAutonomousRegime(this.activeSignalType);
    const id = pb.id.toUpperCase();
    if (id.includes('EARLY') && regime === 'EARLY_EXPANSION') return true;
    if (id.includes('PERSIST') && (regime === 'PERSISTENT_CONTINUATION' || regime === 'ACCELERATION_INTEGRITY')) return true;
    if (id.includes('PULLBACK') && regime === 'SHALLOW_PULLBACK_CONTINUATION') return true;
    if (id.includes('VWAP') && regime === 'VWAP_ACCEPTANCE') return true;
    if (id.includes('COMPRESSION') && regime === 'COMPRESSION_BREAKOUT') return true;
    if (id.includes('EXHAUSTION') && regime === 'EXHAUSTION_DRIFT') return true;
    return false;
  }

  liveStatus(pb: Playbook): string {
    if (this.matchesSignal(pb)) return 'ACTIVE';
    return pb.contextualStatus ?? 'NEUTRAL';
  }

  tabClass(pb: Playbook): string {
    const st = this.liveStatus(pb);
    if (st === 'ACTIVE') return 'tab-active-live';
    if (st === 'FAVORING') return 'tab-favoring';
    if (st === 'WEAK' || st === 'AVOID') return 'tab-weak';
    return '';
  }

  detailClass(pb: Playbook): string {
    const st = this.liveStatus(pb);
    if (st === 'ACTIVE') return 'detail-active';
    if (st === 'WEAK' || st === 'AVOID') return 'detail-dim';
    return '';
  }
}
