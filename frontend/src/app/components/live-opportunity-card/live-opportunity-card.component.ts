import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActiveSignal } from '../../models/workspace.model';
import { MarketTrend } from '../../models/workspace.model';
import { ScannerOpportunityCard } from '../../services/autonomous-regime-scanner/autonomous-regime-scanner.models';
import { formatAutonomousLabel } from '../../services/autonomous-regime-scanner/scanner-ranking.engine';
import { formatAutonomousRegime } from '../../utils/autonomous-terminology.util';
import { ConfidenceBarComponent } from '../confidence-bar/confidence-bar.component';
import { computeAttentionPriority, priorityClass, priorityPulse } from '../../utils/attention-priority.util';
import { computeSignalHealth } from '../../utils/signal-health.util';
import { signalAccentClass } from '../../utils/context-emphasis.util';
import { TOOLTIPS } from '../../utils/micro-tooltips.util';

@Component({
  selector: 'app-live-opportunity-card',
  standalone: true,
  imports: [ConfidenceBarComponent, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './live-opportunity-card.component.html',
  styleUrl: './live-opportunity-card.component.scss'
})
export class LiveOpportunityCardComponent {
  @Input({ required: true }) signal!: ActiveSignal;
  @Input() autonomousCard: ScannerOpportunityCard | null = null;
  @Input() rankIndex = 0;
  @Input() marketTrend: MarketTrend | null = null;
  @Input() triggerDistancePct: number | null = null;
  @Input() actionVerb: string | null = null;
  @Input() compactRadar = false;
  @Input() radarEmphasis = false;
  @Input() isActive = false;
  @Input() decayOpacity = 1;
  @Output() selected = new EventEmitter<string>();

  attention() {
    return computeAttentionPriority(this.signal, this.marketTrend, this.rankIndex);
  }

  priorityCls(): string {
    return priorityClass(this.attention().priority);
  }

  shouldPulse(): boolean {
    return this.rankIndex <= 1 && priorityPulse(this.attention().priority, this.signal.freshness);
  }

  accentClass(): string {
    return signalAccentClass(this.signal.signalType);
  }

  emphasisClass(): string {
    return this.attention().emphasis.cssClass;
  }

  healthClass(): string {
    return computeSignalHealth(this.signal).cssClass;
  }

  displayType(type: string): string {
    if (this.autonomousCard) {
      return formatAutonomousLabel(this.autonomousCard.opportunityType);
    }
    return formatAutonomousRegime(type);
  }

  autonomousAction(): string | null {
    return this.autonomousCard?.badge.replace(/^[^\s]+\s/, '') ?? null;
  }

  convictionScore(): number {
    return this.autonomousCard?.convictionScore ?? this.attention().score;
  }

  freshnessLabel(): string {
    if (this.signal.freshness === 'FRESH') return 'NEW';
    return this.signal.freshnessLabel ?? this.signal.freshness ?? '—';
  }

  isFailed(): boolean {
    const s = this.signal.lifecycleState?.toUpperCase();
    return s === 'FAILED' || s === 'EXITING'
      || this.signal.signalType?.includes('FAIL') === true;
  }

  isWatching(): boolean {
    return this.signal.signalType === 'WATCH'
      || this.signal.lifecycleState?.toUpperCase() === 'WATCHING';
  }

  highRvol(): boolean {
    return (this.signal.relativeVolume ?? 0) >= 3;
  }

  radarState(): string {
    if (this.autonomousCard) {
      const a = this.autonomousCard.action;
      if (a === 'AVOID') return 'AVOID';
      if (a === 'WATCH') return 'WATCH';
      if (a === 'ADD') return 'ADD';
      return 'ENTER';
    }
    if (this.isFailed()) return 'FAILED';
    if (this.actionVerb) {
      const v = this.actionVerb.toUpperCase();
      if (v.includes('BREAKOUT')) return 'BREAKOUT';
      if (v.includes('OPEN')) return 'OPEN MOM';
      if (v.includes('WATCH')) return 'WATCH';
      return v.slice(0, 12);
    }
    const t = this.displayType(this.signal.signalType);
    return t.length > 10 ? t.slice(0, 9) + '…' : t;
  }

  radarDistance(): string {
    if (this.triggerDistancePct != null) {
      return `${this.triggerDistancePct.toFixed(1)}%`;
    }
    const rvol = this.signal.relativeVolume;
    return rvol != null ? `${rvol.toFixed(1)}x` : '—';
  }

  radarRegime(): string {
    const m = this.marketTrend;
    if (!m) return '—';
    if (m.regime === 'CHOPPY' || m.choppy) return 'CHOP';
    const t = (m.spyTrend ?? m.regime ?? '').toUpperCase();
    if (t.includes('BULL')) return 'BULL';
    if (t.includes('BEAR')) return 'BEAR';
    return t.slice(0, 4) || '—';
  }

  tooltip(key: keyof typeof TOOLTIPS): string {
    return TOOLTIPS[key];
  }
}
