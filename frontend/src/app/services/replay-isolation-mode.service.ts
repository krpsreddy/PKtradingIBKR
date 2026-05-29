import { Injectable } from '@angular/core';
import { ResearchModeService } from './research-mode.service';

/**
 * Phase 195 — hard isolation for Replay Lab (historical workstation only).
 * When isolated, live scanner UI, feeds, hydration, and runtime polling are disabled.
 */
@Injectable({ providedIn: 'root' })
export class ReplayIsolationModeService {
  constructor(private research: ResearchModeService) {}

  /** True on Replay Lab in default research mode (not live debug). */
  isolated(): boolean {
    return this.research.isResearch();
  }

  blocksLivePolling(): boolean {
    return this.isolated();
  }

  blocksLiveScannerUi(): boolean {
    return this.isolated();
  }

  blocksLiveSubscriptions(): boolean {
    return this.isolated();
  }
}
