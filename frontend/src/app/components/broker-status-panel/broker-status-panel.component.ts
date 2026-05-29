import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrokerConnectionService } from '../../services/broker/broker-connection.service';
import { BrokerConnectionStatus, BrokerProfile } from '../../services/broker/broker.models';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-broker-status-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './broker-status-panel.component.html',
  styleUrl: './broker-status-panel.component.scss'
})
export class BrokerStatusPanelComponent implements OnInit, OnDestroy {
  status: BrokerConnectionStatus | null = null;
  profiles: BrokerProfile[] = [];
  switchOpen = false;
  switching = false;
  confirmLive: BrokerProfile | null = null;
  error: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(private broker: BrokerConnectionService) {}

  ngOnInit(): void {
    this.broker.loadProfiles().pipe(takeUntil(this.destroy$)).subscribe();
    this.broker.refreshStatus().pipe(takeUntil(this.destroy$)).subscribe();
    this.broker.startEventStream();
    this.broker.status$.pipe(takeUntil(this.destroy$)).subscribe(s => {
      this.status = s;
      if (s?.connected) {
        this.switching = false;
      }
    });
    this.broker.profiles$.pipe(takeUntil(this.destroy$)).subscribe(p => {
      this.profiles = p.filter(x => x.enabled);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.broker.stopEventStream();
  }

  dotClass(): string {
    if (!this.status?.connected) return 'dot-off';
    return this.status.mode === 'LIVE' ? 'dot-live' : 'dot-on';
  }

  openSwitch(): void {
    this.switchOpen = true;
    this.error = null;
  }

  closeSwitch(): void {
    this.switchOpen = false;
    this.confirmLive = null;
  }

  selectProfile(p: BrokerProfile): void {
    if (p.mode === 'LIVE') {
      this.confirmLive = p;
      return;
    }
    this.applySwitch(p.id);
  }

  confirmLiveSwitch(): void {
    if (!this.confirmLive) return;
    this.applySwitch(this.confirmLive.id);
    this.confirmLive = null;
  }

  private applySwitch(profileId: string): void {
    this.switching = true;
    this.error = null;
    this.broker.connect(profileId).subscribe({
      next: () => {
        this.switchOpen = false;
        this.switching = false;
      },
      error: err => {
        this.switching = false;
        this.error = err?.error?.error ?? err?.message ?? 'Switch failed';
      }
    });
  }
}
