import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { ExecutionTemplateValidationService } from '../../services/execution-template-validation/execution-template-validation.service';
import { ExecutionTemplateValidationReport } from '../../services/execution-template-validation/execution-template-validation.models';

@Component({
  selector: 'app-execution-template-validation-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './execution-template-validation-panel.component.html',
  styleUrl: './execution-template-validation-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExecutionTemplateValidationPanelComponent implements OnInit, OnDestroy {
  report: ExecutionTemplateValidationReport | null = null;
  expanded = false;
  progressLabel = '';
  running = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly validation: ExecutionTemplateValidationService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.report = this.validation.snapshot();
    this.validation.report$.pipe(takeUntil(this.destroy$)).subscribe(r => {
      this.report = r;
      this.cdr.markForCheck();
    });
    this.validation.progress$.pipe(takeUntil(this.destroy$)).subscribe(p => {
      this.progressLabel = p ? `${p.phase} (${p.done}/${p.total})` : '';
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async runValidation(): Promise<void> {
    this.running = true;
    this.expanded = true;
    this.cdr.markForCheck();
    try {
      await this.validation.runValidation();
    } finally {
      this.running = false;
      this.cdr.markForCheck();
    }
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  recommendationLabel(): string {
    const r = this.report?.defaultRecommendation;
    if (r === 'AUTONOMOUS_TEMPLATE') return 'Switch AUTONOMOUS_TEMPLATE default globally';
    if (r === 'HYBRID') return 'Hybrid default (regime routing)';
    return 'Keep LEGACY_RR default';
  }
}
