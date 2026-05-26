import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CoachingResponse } from '../../ai/models/ai.models';
import { AiExecutionIntelligenceService } from '../../ai/services/ai-execution-intelligence.service';

@Component({
  selector: 'app-ai-coaching-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ai-coaching-panel">
      <header class="panel-head">
        <span class="label">AI Coaching</span>
        @if (loading) { <span class="state">loading…</span> }
        @else if (coaching?.fallbackUsed) { <span class="state muted">deterministic fallback</span> }
      </header>
      @if (coaching) {
        @if (coaching.headline) {
          <p class="headline">{{ coaching.headline }}</p>
        }
        @for (s of coaching.suggestions; track s) {
          <p class="suggestion">→ {{ s }}</p>
        }
        @for (n of coaching.psychologyNotes; track n) {
          <p class="psych">“{{ n }}”</p>
        }
      } @else if (!loading) {
        <p class="empty">AI coaching unavailable — deterministic review active.</p>
      }
    </section>
  `,
  styles: [`
    .ai-coaching-panel {
      padding: 12px 14px;
      border: 1px solid rgba(48, 54, 61, 0.35);
      border-radius: 4px;
      background: rgba(22, 27, 34, 0.55);
    }
    .panel-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 8px; }
    .label { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; color: #8b949e; text-transform: uppercase; }
    .state { font-size: 0.625rem; color: #58a6ff; }
    .state.muted { color: #6e7681; }
    .headline { margin: 0 0 8px; font-size: 0.8125rem; font-weight: 600; color: #e6edf3; }
    .suggestion { margin: 4px 0; font-size: 0.75rem; color: #b8c4d0; }
    .psych { margin: 6px 0; font-size: 0.6875rem; font-style: italic; color: #8b949e; line-height: 1.4; }
    .empty { margin: 0; font-size: 0.75rem; color: #6e7681; }
  `]
})
export class AiCoachingPanelComponent implements OnChanges {
  @Input() symbol = '';
  coaching: CoachingResponse | null = null;
  loading = false;

  constructor(private ai: AiExecutionIntelligenceService) {}

  ngOnChanges(): void {
    if (!this.symbol) return;
    this.loading = true;
    this.ai.generateCoaching(this.symbol).then(c => {
      this.coaching = c;
      this.loading = false;
    }).catch(() => {
      this.loading = false;
    });
  }
}
