import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TradingSignal } from '../../models/signal.model';
import { computeSignalHealth } from '../../utils/signal-health.util';

export interface TimelineEntry {
  timestamp: string;
  signalType: string;
  lifecycleState?: string | null;
  healthClass: string;
  healthLabel: string;
  signal: TradingSignal;
}

const LIFECYCLE_ORDER = [
  'OPEN_SCOUT', 'OPEN_READY', 'OPEN_MOM_BUY', 'CONT_READY', 'CONT_BUY',
  'MOM_BUY', 'EXTENDED', 'WEAKENING', 'EXIT'
];

@Component({
  selector: 'app-signal-timeline-panel',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './signal-timeline-panel.component.html',
  styleUrl: './signal-timeline-panel.component.scss'
})
export class SignalTimelinePanelComponent {
  @Input() symbol = '';
  @Input() entries: TimelineEntry[] = [];
  @Input() selectedTimestamp: string | null = null;
  @Output() entrySelected = new EventEmitter<TradingSignal>();

  lifecycleStages = LIFECYCLE_ORDER;

  displayType(type: string): string {
    return type.replace(/_/g, ' ');
  }

  stageLabel(stage: string): string {
    if (stage === 'OPEN_MOM_BUY') return 'OPEN MOM';
    if (stage === 'CONT_BUY') return 'CONT BUY';
    return stage.replace(/_/g, ' ');
  }

  isStageActive(stage: string): boolean {
    if (this.entries.length === 0) return false;
    const latest = this.entries[this.entries.length - 1];
    if (stage === 'EXTENDED' && latest.signal.extended) return true;
    if (stage === 'WEAKENING' && latest.lifecycleState === 'WEAKENING') return true;
    if (stage === 'EXIT' && (latest.signalType === 'EXIT' || latest.lifecycleState === 'EXITED')) return true;
    return latest.signalType === stage;
  }

  isStagePassed(stage: string): boolean {
    const idx = LIFECYCLE_ORDER.indexOf(stage);
    if (idx < 0) return false;
    const activeIdx = this.entries.reduce((max, e) => {
      let i = LIFECYCLE_ORDER.indexOf(e.signalType);
      if (e.signal.extended && LIFECYCLE_ORDER.indexOf('EXTENDED') > i) {
        i = LIFECYCLE_ORDER.indexOf('EXTENDED');
      }
      if (e.lifecycleState === 'WEAKENING' && LIFECYCLE_ORDER.indexOf('WEAKENING') > i) {
        i = LIFECYCLE_ORDER.indexOf('WEAKENING');
      }
      return Math.max(max, i);
    }, -1);
    return activeIdx > idx;
  }

  trackEntry(_: number, e: TimelineEntry): string {
    return e.timestamp + e.signalType;
  }
}

export function buildTimelineEntries(signals: TradingSignal[]): TimelineEntry[] {
  return [...signals]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(signal => {
      const health = computeSignalHealth(signal);
      return {
        timestamp: signal.timestamp,
        signalType: signal.signalType,
        lifecycleState: signal.lifecycleState,
        healthClass: health.cssClass,
        healthLabel: health.label,
        signal
      };
    });
}
