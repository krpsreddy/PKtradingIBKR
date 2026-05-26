import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  NetworkDiagnosticsService,
  NetworkDiagnosticsSnapshot
} from '../../services/network/network-diagnostics.service';

/** Dev overlay: request rate, pending XHR, cache hits, feed transport. */
@Component({
  selector: 'app-network-diagnostics-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible) {
      <div class="net-diag" role="status" aria-live="polite">
        <div class="net-diag__title">Network</div>
        <div class="net-diag__row"><span>RPS</span><strong>{{ snap.requestsPerSec }}</strong></div>
        <div class="net-diag__row"><span>Pending</span><strong>{{ snap.pending }}</strong></div>
        <div class="net-diag__row"><span>Cache hit</span><strong>{{ (snap.cacheHitRate * 100) | number:'1.0-0' }}%</strong></div>
        <div class="net-diag__row"><span>Deduped</span><strong>{{ snap.deduped }}</strong></div>
        <div class="net-diag__row"><span>Stale drop</span><strong>{{ snap.droppedStale }}</strong></div>
        <div class="net-diag__row"><span>Feed</span><strong>{{ snap.feedTransport }}</strong></div>
        <div class="net-diag__row"><span>Max concurrent</span><strong>{{ snap.maxConcurrent }}</strong></div>
      </div>
    }
  `,
  styles: [`
    .net-diag {
      position: fixed;
      bottom: 12px;
      left: 12px;
      z-index: 9999;
      font: 11px/1.4 ui-monospace, monospace;
      background: rgba(13, 17, 23, 0.92);
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 8px 10px;
      color: #c9d1d9;
      min-width: 140px;
      pointer-events: none;
    }
    .net-diag__title { font-weight: 600; margin-bottom: 4px; color: #58a6ff; }
    .net-diag__row { display: flex; justify-content: space-between; gap: 12px; }
    .net-diag__row strong { color: #f0f6fc; }
  `]
})
export class NetworkDiagnosticsPanelComponent implements OnInit, OnDestroy {
  visible = !!(environment as { showNetworkDiagnostics?: boolean }).showNetworkDiagnostics;
  snap!: NetworkDiagnosticsSnapshot;
  private sub?: Subscription;

  constructor(
    private diagnostics: NetworkDiagnosticsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    if (!this.visible) return;
    this.snap = this.diagnostics.snapshot();
    this.sub = this.diagnostics.snapshot$.subscribe(s => {
      this.snap = s;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
