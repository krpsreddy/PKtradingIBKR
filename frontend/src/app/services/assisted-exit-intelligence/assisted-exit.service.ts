import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PaperExecutionRecord } from '../../models/paper-execution.model';
import { ExecutionMonitorSnapshot } from '../../models/paper-execution.model';
import { RealTimeExecutionService } from '../real-time-execution/real-time-execution.service';
import {
  AssistedExitLearningStats,
  AssistedExitSnapshot,
  AssistedPositionView
} from './assisted-exit.models';
import { scoreContinuationHealth, scoreContinuationSurvival } from './continuation-survival.engine';
import { scorePersistenceHold, scorePersistenceSurvival } from './persistence-hold.engine';
import { scoreExitPressure } from './exit-pressure.engine';
import { scorePostEntryMfeCapture, scoreTrailingQuality } from './trailing-quality.engine';
import { scoreSecondLegProbability } from './second-leg-monitor.engine';
import {
  buildExitAdvisories,
  buildPostEntryTelemetry,
  healthToneFromLifecycle,
  primaryAdvisory,
  resolveLifecycleState
} from './exit-advisory.engine';
import { environment } from '../../../environments/environment';

const LEARNING_KEY = ((environment as { storagePrefix?: string }).storagePrefix ?? '') + 'assisted-exit-learning';

/** Phase 182 — event-driven assisted exit intelligence (no auto exits). */
@Injectable({ providedIn: 'root' })
export class AssistedExitService {
  private readonly snapshotSubject = new BehaviorSubject<AssistedExitSnapshot | null>(null);
  readonly snapshot$ = this.snapshotSubject.asObservable();

  constructor(private rtExecution: RealTimeExecutionService) {}

  refresh(monitor: ExecutionMonitorSnapshot): AssistedExitSnapshot {
    const active = [...monitor.activePositions, ...monitor.activeOrders.filter(o => o.status === 'SUBMITTED')];
    const positions = active.map(r => this.buildPositionView(r));
    const learning = this.mergeLearning(monitor.history);
    const snap: AssistedExitSnapshot = {
      positions,
      learning,
      generatedAt: Date.now()
    };
    this.snapshotSubject.next(snap);
    return snap;
  }

  snapshot(): AssistedExitSnapshot | null {
    return this.snapshotSubject.value;
  }

  buildPositionView(record: PaperExecutionRecord): AssistedPositionView {
    const feed = this.rtExecution.itemForSymbol(record.symbol);
    const exitPressure = scoreExitPressure(record, feed);
    const continuationHealth = scoreContinuationHealth(record, feed);
    const telemetry = buildPostEntryTelemetry(record, feed);
    const lifecycleState = resolveLifecycleState(record, feed, exitPressure, continuationHealth);
    const metrics = {
      holdQuality: scorePersistenceHold(record, feed),
      continuationHealth,
      secondLegProbability: scoreSecondLegProbability(record, feed),
      exitPressure,
      persistenceSurvival: scoreContinuationSurvival(record, feed),
      postEntryMfeCapture: scorePostEntryMfeCapture(record)
    };
    const advisories = buildExitAdvisories(record, feed, lifecycleState, telemetry, exitPressure);
    const entry = record.fillPrice ?? record.entryPrice;
    const unrealizedR = entry && record.mfeR != null ? record.mfeR : null;
    const submitted = record.submittedAt ? new Date(record.submittedAt).getTime() : Date.now();
    return {
      record,
      feed,
      lifecycleState,
      healthTone: healthToneFromLifecycle(lifecycleState),
      telemetry,
      metrics,
      advisories,
      primaryAdvisory: primaryAdvisory(advisories),
      unrealizedR,
      holdDurationSec: Math.floor((Date.now() - submitted) / 1000)
    };
  }

  private mergeLearning(history: PaperExecutionRecord[]): AssistedExitLearningStats {
    const closed = history.filter(h => h.status === 'CLOSED');
    let missed = 0;
    let premature = 0;
    let secondLeg = 0;
    let falseExh = 0;
    let postExitSum = 0;
    let postExitN = 0;
    let trailEff = 0;
    let trailN = 0;

    for (const h of closed) {
      const mfe = h.mfeR ?? 0;
      const realized = h.realizedR ?? 0;
      if (mfe > 0.008 && realized < mfe * 0.45) {
        missed++;
        premature++;
      }
      if (h.secondLegCaptured) secondLeg++;
      if (/EXHAUSTION/i.test(h.regime) && (h.postExitContinuationR ?? 0) > 0.005) falseExh++;
      if (h.postExitContinuationR != null) {
        postExitSum += h.postExitContinuationR;
        postExitN++;
      }
      if (mfe > 0 && realized > 0) {
        trailEff += realized / mfe;
        trailN++;
      }
    }

    const base: AssistedExitLearningStats = {
      missedContinuationAfterExit: missed,
      persistenceSurvivalAfterTrim: closed.filter(c => c.continuationSurvival).length,
      trailingContinuationEfficiency: trailN ? trailEff / trailN : 0,
      prematureExitCount: premature,
      secondLegCaptureCount: secondLeg,
      exhaustionFalsePositiveCount: falseExh,
      avgPostExitExpansionPct: postExitN ? (postExitSum / postExitN) * 100 : 0,
      sampleCount: closed.length
    };
    this.persistLearning(base);
    return base;
  }

  private persistLearning(stats: AssistedExitLearningStats): void {
    try {
      localStorage.setItem(LEARNING_KEY, JSON.stringify(stats));
    } catch {
      /* ignore */
    }
  }

  loadLearning(): AssistedExitLearningStats {
    try {
      const raw = localStorage.getItem(LEARNING_KEY);
      if (raw) return JSON.parse(raw) as AssistedExitLearningStats;
    } catch {
      /* ignore */
    }
    return {
      missedContinuationAfterExit: 0,
      persistenceSurvivalAfterTrim: 0,
      trailingContinuationEfficiency: 0,
      prematureExitCount: 0,
      secondLegCaptureCount: 0,
      exhaustionFalsePositiveCount: 0,
      avgPostExitExpansionPct: 0,
      sampleCount: 0
    };
  }
}
