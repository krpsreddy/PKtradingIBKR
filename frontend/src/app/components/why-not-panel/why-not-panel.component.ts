import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ExecutionSnapshot } from '../../models/refinement.model';
import { SetupCandidate, SetupDeterioration } from '../../models/execution.model';
import { OptionsExecutionSnapshot } from '../../models/probabilistic.model';

@Component({
  selector: 'app-why-not-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './why-not-panel.component.html',
  styleUrl: './why-not-panel.component.scss'
})
export class WhyNotPanelComponent {
  @Input() symbol = '';
  @Input() snapshot: ExecutionSnapshot | null = null;
  @Input() source: SetupCandidate | null = null;
  @Input() deterioration: SetupDeterioration | null = null;
  @Input() optionsExecution: OptionsExecutionSnapshot | null = null;

  reasons(): string[] {
    const r: string[] = [];
    if (this.snapshot?.whyNotReasons?.length) r.push(...this.snapshot.whyNotReasons);
    if (this.source?.extended) r.push('Extended');
    if (this.source?.freshness === 'AGING' || this.source?.freshness === 'STALE') r.push('Late entry');
    if (this.source?.regimeAligned === false) r.push('Weak regime');
    for (const d of this.deterioration?.reasons ?? []) {
      const short = d.length > 24 ? d.slice(0, 22) + '…' : d;
      if (!r.some(x => x.toLowerCase().includes(short.slice(0, 8).toLowerCase()))) r.push(short);
    }
    if (this.optionsExecution?.thetaRisk === 'HIGH' || this.optionsExecution?.thetaRisk === 'EXTREME') {
      r.push('Theta risk');
    }
    if (this.optionsExecution?.ivRisk === 'CRUSH_RISK') r.push('IV crush');
    if (this.optionsExecution?.avoidReason) {
      for (const part of this.optionsExecution.avoidReason.split(' · ')) {
        if (!r.includes(part)) r.push(part);
      }
    }
    return r.slice(0, 6);
  }

  stripText(): string {
    if (this.snapshot?.noEdge) return this.snapshot.noEdgeMessage ?? 'NO EDGE';
    const parts = this.reasons();
    return parts.length ? parts.join(' • ') : '';
  }

  hasConcerns(): boolean {
    return this.reasons().length > 0 || !!this.snapshot?.noEdge;
  }
}
