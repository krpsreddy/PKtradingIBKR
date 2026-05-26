import { Injectable, Injector } from '@angular/core';
import { EdgeRefinementReportService } from '../edge-refinement/edge-refinement-report.service';
import { WinnerDecompositionSynthesisService } from '../winner-decomposition/winner-decomposition-synthesis.service';
import { LiveRegimeSynthesisService } from '../../live-regime-intelligence/live-regime-synthesis.service';
import { PlaybookDiscoveryService } from '../playbook-discovery/playbook-discovery.service';
import { ContinuationPromotionSynthesisService } from '../continuation-promotion/continuation-promotion-synthesis.service';
import { ExpansionParticipationSynthesisService } from '../opening-expansion/expansion-participation-synthesis.service';
import { AutonomousDiscoverySynthesisService } from '../autonomous-discovery/autonomous-discovery-synthesis.service';
import { ContinuationParticipationSynthesisService } from '../continuation-participation/continuation-participation-synthesis.service';
import { AutonomousExecutionSynthesisService } from '../autonomous-execution/autonomous-execution-synthesis.service';
import { RobustnessValidationSynthesisService } from '../robustness-validation/robustness-validation-synthesis.service';
import { ExecutionTriggerSynthesisService } from '../../execution-trigger-intelligence/execution-trigger-synthesis.service';
import { IntelligenceOffloadService } from '../../intelligence-offload/intelligence-offload.service';

/** Phase 149 — defer expensive analytics synthesis until after UI render. */
@Injectable({ providedIn: 'root' })
export class LazyAnalyticsEnrichmentService {
  private scheduled = false;
  private pending = false;

  constructor(
    private injector: Injector,
    private offload: IntelligenceOffloadService
  ) {}

  /** Schedule background enrichment — non-blocking. */
  scheduleEnrichment(delayMs = 100): void {
    this.pending = true;
    if (this.scheduled) return;
    this.scheduled = true;

    setTimeout(() => {
      this.scheduled = false;
      if (!this.pending) return;
      this.pending = false;
      void this.runEnrichment();
    }, delayMs);
  }

  /** Run immediately (still async — does not block caller). */
  async runEnrichment(): Promise<void> {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        try {
          this.injector.get(EdgeRefinementReportService).refresh();
          this.injector.get(WinnerDecompositionSynthesisService).refresh();
          this.injector.get(LiveRegimeSynthesisService).refresh();
          this.injector.get(PlaybookDiscoveryService).refresh();
          this.injector.get(ContinuationPromotionSynthesisService).refresh();
          this.injector.get(ExpansionParticipationSynthesisService).refresh();
          this.injector.get(AutonomousDiscoverySynthesisService).refresh();
          this.injector.get(ContinuationParticipationSynthesisService).refresh();
          this.injector.get(AutonomousExecutionSynthesisService).refresh();
          this.injector.get(RobustnessValidationSynthesisService).refresh();
          this.injector.get(ExecutionTriggerSynthesisService).refresh();
        } finally {
          resolve();
        }
      });
    });
  }

  flush(): void {
    this.pending = true;
    void this.runEnrichment();
  }
}
