import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExecutionPlan } from '../../services/execution-plan/execution-plan.models';
import { ExecutionPlanMode } from '../../services/autonomous-execution-templates/autonomous-template.models';
import { ExecutionPlanModeService } from '../../services/execution-plan/execution-plan-mode.service';

export interface PlanCompareRow {
  label: string;
  legacy: string;
  autonomous: string;
  delta?: boolean;
}

@Component({
  selector: 'app-execution-plan-comparison',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './execution-plan-comparison.component.html',
  styleUrl: './execution-plan-comparison.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExecutionPlanComparisonComponent {
  @Input() legacy: ExecutionPlan | null = null;
  @Input() autonomous: ExecutionPlan | null = null;

  constructor(public planMode: ExecutionPlanModeService) {}

  modes: { id: ExecutionPlanMode; label: string }[] = [
    { id: 'LEGACY_RR', label: 'Legacy RR' },
    { id: 'AUTONOMOUS_TEMPLATE', label: 'Autonomous' },
    { id: 'COMPARE', label: 'Compare' }
  ];

  setMode(mode: ExecutionPlanMode): void {
    this.planMode.setMode(mode);
  }

  rows(): PlanCompareRow[] {
    const l = this.legacy;
    const a = this.autonomous;
    if (!l && !a) return [];

    const fmt = (p: ExecutionPlan | null, key: keyof PlanCompareRow | 'entry' | 'stop' | 'target' | 'rr' | 'inv' | 'life') => {
      if (!p) return '—';
      switch (key) {
        case 'entry':
          return `$${(p.entryZone.ideal ?? p.entryZone.low).toFixed(2)} (${p.entryZone.low.toFixed(2)}–${p.entryZone.high.toFixed(2)})`;
        case 'stop':
          return `$${p.stopZone.price.toFixed(2)}`;
        case 'target':
          return `$${p.targetZone.primary?.toFixed(2) ?? '—'}`;
        case 'rr':
          return p.riskReward != null ? `${p.riskReward}` : '—';
        case 'inv':
          return `$${(p.stopZone.invalidation ?? p.stopZone.price).toFixed(2)}`;
        case 'life':
          return p.lifecycleState ?? '—';
        default:
          return '—';
      }
    };

    const mk = (label: string, key: 'entry' | 'stop' | 'target' | 'rr' | 'inv' | 'life'): PlanCompareRow => {
      const lv = fmt(l, key);
      const av = fmt(a, key);
      return { label, legacy: lv, autonomous: av, delta: lv !== av && lv !== '—' && av !== '—' };
    };

    return [
      mk('Entry', 'entry'),
      mk('Stop', 'stop'),
      mk('Target', 'target'),
      mk('RR', 'rr'),
      mk('Invalidation', 'inv'),
      mk('Lifecycle', 'life'),
      {
        label: 'Source',
        legacy: l?.source ?? '—',
        autonomous: a?.source ?? '—',
        delta: l?.source !== a?.source
      },
      {
        label: 'Regime',
        legacy: l?.canonicalRegime ?? '—',
        autonomous: a?.canonicalRegime ?? '—',
        delta: l?.canonicalRegime !== a?.canonicalRegime
      }
    ];
  }
}
