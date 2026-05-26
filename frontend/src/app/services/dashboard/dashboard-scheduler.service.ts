import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { DASHBOARD_TASKS, DashboardTaskId } from './dashboard-scheduler.config';
import { RuntimeScanControlService } from '../runtime-scan/runtime-scan-control.service';

/** Single heartbeat orchestrating all dashboard refresh tasks (visibility-aware). */
@Injectable({ providedIn: 'root' })
export class DashboardSchedulerService implements OnDestroy {
  private readonly tickSubject = new Subject<DashboardTaskId>();
  readonly tick$ = this.tickSubject.asObservable();

  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private lastRun = new Map<DashboardTaskId, number>();
  private paused = false;
  private tabVisible = true;
  private active = false;

  constructor(
    private zone: NgZone,
    private scanControl: RuntimeScanControlService
  ) {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.tabVisible = document.visibilityState === 'visible';
      });
    }
  }

  start(): void {
    if (this.heartbeatId) return;
    this.active = true;
    this.zone.runOutsideAngular(() => {
      this.heartbeatId = setInterval(() => this.onHeartbeat(), 500);
    });
  }

  stop(): void {
    this.active = false;
    if (this.heartbeatId) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  /** Force immediate tick for a task (e.g. symbol change). */
  trigger(taskId: DashboardTaskId): void {
    this.lastRun.delete(taskId);
    this.zone.run(() => this.tickSubject.next(taskId));
  }

  ngOnDestroy(): void {
    this.stop();
    this.tickSubject.complete();
  }

  private onHeartbeat(): void {
    if (!this.active || this.paused) return;
    const now = Date.now();
    for (const task of DASHBOARD_TASKS) {
      if (task.enabled && !task.enabled()) continue;
      let interval = this.tabVisible ? task.intervalMs : task.hiddenIntervalMs;
      if (task.tier === 1) interval = this.scanControl.tier1IntervalMs();
      else if (task.id === 'scanner') interval = this.scanControl.tier2ScannerIntervalMs();
      else if (task.id === 'executionPlanRefresh') interval = this.scanControl.tier2PlanIntervalMs();
      const last = this.lastRun.get(task.id) ?? 0;
      if (now - last >= interval) {
        this.lastRun.set(task.id, now);
        this.zone.run(() => this.tickSubject.next(task.id));
      }
    }
  }
}
