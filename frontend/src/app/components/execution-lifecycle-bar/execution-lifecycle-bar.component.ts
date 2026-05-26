import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { LifecycleTimeline } from '../../services/execution-lifecycle/execution-lifecycle.engine';

/** Phase 169 — regime evolution timeline bar. */
@Component({
  selector: 'app-execution-lifecycle-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lifecycle-bar" role="progressbar" [attr.aria-valuenow]="timeline.progressPct">
      <div class="lifecycle-track">
        @for (stage of timeline.stages; track stage.id) {
          <span class="stage-seg"
                [class.active]="stage.active"
                [class.complete]="stage.complete"
                [class.exhaust]="stage.id === 'EXHAUSTING' || stage.id === 'FAILED'"
                [title]="stage.label + (stage.active ? ' · ' + stage.durationSeconds + 's · ' + stage.nextStageProbability + '% next' : '')">
          </span>
        }
      </div>
      <div class="lifecycle-meta">
        <span class="current">{{ currentLabel }}</span>
        @if (activeStage) {
          <span class="dur">{{ activeStage.durationSeconds }}s</span>
          <span class="stab">stab {{ activeStage.stability }}%</span>
          <span class="next">{{ activeStage.nextStageProbability }}% next</span>
        }
      </div>
    </div>
  `,
  styles: [`
    .lifecycle-bar { display: flex; flex-direction: column; gap: 0.2rem; }
    .lifecycle-track {
      display: flex; gap: 2px; height: 4px;
    }
    .stage-seg {
      flex: 1; border-radius: 2px;
      background: var(--lifecycle-pending, #30363d);
      transition: background 0.2s;
    }
    .stage-seg.complete { background: var(--lifecycle-complete, #3fb950); opacity: 0.55; }
    .stage-seg.active { background: var(--lifecycle-active, #58a6ff); opacity: 1; }
    .stage-seg.exhaust.active { background: var(--lifecycle-exhaust, #f85149); }
    .lifecycle-meta {
      display: flex; flex-wrap: wrap; gap: 0.35rem 0.5rem;
      font-size: 0.58rem; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--text-muted, #8b949e);
    }
    .current { color: var(--text-accent, #58a6ff); font-weight: 700; }
    .next { color: var(--text-secondary, #c9d1d9); }
  `]
})
export class ExecutionLifecycleBarComponent {
  @Input({ required: true }) timeline!: LifecycleTimeline;

  get currentLabel(): string {
    const active = this.timeline.stages.find(s => s.active);
    return active?.label ?? this.timeline.currentStageId.replace(/_/g, ' ');
  }

  get activeStage() {
    return this.timeline.stages.find(s => s.active);
  }
}
