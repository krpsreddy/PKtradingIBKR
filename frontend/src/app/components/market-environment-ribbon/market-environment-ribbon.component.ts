import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { MarketTrend } from '../../models/workspace.model';
import { SessionTemperature, MarketPersonality, SessionPriority, IntelligenceSummary } from '../../models/cognition.model';
import { MarketTrust } from '../../models/probabilistic.model';

@Component({
  selector: 'app-market-environment-ribbon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './market-environment-ribbon.component.html',
  styleUrl: './market-environment-ribbon.component.scss'
})
export class MarketEnvironmentRibbonComponent implements OnChanges {
  @Input() marketTrend: MarketTrend | null = null;
  @Input() sessionTemperature: SessionTemperature | null = null;
  @Input() marketPersonality: MarketPersonality | null = null;
  @Input() marketTrust: MarketTrust | null = null;
  @Input() strongestSector: string | null = null;
  @Input() breadthQuality: string | null = null;
  @Input() topPriorities: string[] = [];
  @Input() heartbeatPulses: string[] = [];
  @Input() marketEmotion: { label: string; description: string } | null = null;
  @Input() sessionPriority: SessionPriority | null = null;
  @Input() coachingHighlights: string[] = [];
  @Input() premarketNote: string | null = null;
  @Input() intelligenceSummary: IntelligenceSummary | null = null;

  scrollItems: string[] = [];
  headline = '';

  ngOnChanges(): void {
    const segments: string[] = [];

    if (this.marketTrend?.regime) {
      segments.push(this.marketTrend.regime.replace(/_/g, ' '));
    }
    if (this.marketEmotion?.label) {
      segments.push(this.marketEmotion.label);
    } else if (this.marketPersonality?.personality) {
      segments.push(this.marketPersonality.personality);
    }
    if (this.sessionPriority?.insight) {
      segments.push(this.sessionPriority.insight);
    } else if (this.intelligenceSummary?.whatMattersMost) {
      segments.push(this.intelligenceSummary.whatMattersMost);
    }
    if (this.intelligenceSummary?.whatToAvoid) {
      segments.push(`Avoid: ${this.intelligenceSummary.whatToAvoid}`);
    }
    if (this.premarketNote) {
      segments.push(this.premarketNote);
    }
    for (const note of this.coachingHighlights.slice(0, 2)) {
      if (note && !segments.includes(note)) segments.push(note);
    }
    if (this.sessionTemperature?.label) {
      segments.push(this.sessionTemperature.label);
    }
    if (this.strongestSector) {
      segments.push(`Sector ${this.strongestSector}`);
    }
    if (this.breadthQuality) {
      segments.push(this.breadthQuality);
    }

    this.headline = segments.slice(0, 5).join(' • ') || 'Monitoring session';
    this.scrollItems = this.heartbeatPulses.length
      ? [...this.heartbeatPulses]
      : segments.filter(Boolean);
    if (!this.scrollItems.length) this.scrollItems = [this.headline];
  }

  regimeClass(): string {
    const r = this.marketTrend?.regime?.toLowerCase() ?? '';
    if (r.includes('bull')) return 'bull';
    if (r.includes('bear')) return 'bear';
    if (r === 'choppy') return 'chop';
    return 'neutral';
  }

  regimeLabel(): string {
    return (this.marketTrend?.regime ?? '—').replace(/_/g, ' ');
  }
}
