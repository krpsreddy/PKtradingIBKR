import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';
import { DecimalPipe, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RealTimeExecutionService } from '../../services/real-time-execution/real-time-execution.service';
import { StrategyDefinition } from '../../services/real-time-execution/real-time-execution.models';

/** Phase 167/169 — strategy memory registry with threshold tuning. */
@Component({
  selector: 'app-strategy-memory-panel',
  standalone: true,
  imports: [DecimalPipe, KeyValuePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './strategy-memory-panel.component.html',
  styleUrl: './strategy-memory-panel.component.scss'
})
export class StrategyMemoryPanelComponent implements OnInit {
  @Input() focusSymbol: string | null = null;
  @Output() replaySymbol = new EventEmitter<string>();

  strategies: StrategyDefinition[] = [];
  loading = true;
  editingId: string | null = null;
  editNotes = '';
  editThresholds: Record<string, number> = {};

  constructor(
    private rtExecution: RealTimeExecutionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.rtExecution.loadStrategies().subscribe(list => {
      this.strategies = list;
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  hitRate(s: StrategyDefinition): number {
    return (s.hitRate ?? s.winRate) * 100;
  }

  lastActivationLabel(s: StrategyDefinition): string {
    if (!s.lastActivationAt) return '—';
    return new Date(s.lastActivationAt).toLocaleString();
  }

  toggleActive(s: StrategyDefinition): void {
    const next = !s.active;
    this.rtExecution.setStrategyActive(s.strategyId, next).subscribe(() => {
      this.strategies = this.strategies.map(x =>
        x.strategyId === s.strategyId ? { ...x, active: next } : x
      );
      this.cdr.markForCheck();
    });
  }

  startEdit(s: StrategyDefinition): void {
    this.editingId = s.strategyId;
    this.editNotes = s.notes ?? '';
    this.editThresholds = Object.fromEntries(
      Object.entries(s.thresholds ?? {}).map(([k, v]) => [k, Number(v)])
    );
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingId = null;
    this.cdr.markForCheck();
  }

  saveEdit(s: StrategyDefinition): void {
    this.rtExecution.updateStrategyThresholds(s.strategyId, this.editThresholds, this.editNotes)
      .subscribe(updated => {
        this.strategies = this.strategies.map(x =>
          x.strategyId === s.strategyId ? { ...x, ...updated, notes: updated.notes ?? this.editNotes } : x
        );
        this.editingId = null;
        this.cdr.markForCheck();
      });
  }

  openReplay(sym: string): void {
    this.replaySymbol.emit(sym);
  }
}
