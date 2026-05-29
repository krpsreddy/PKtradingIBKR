import { Injectable } from '@angular/core';
import { Subscription, debounceTime, filter } from 'rxjs';
import { environment } from '../../environments/environment';
import { PaperProbeRequest } from '../models/paper-execution.model';
import { ExecutionModeService } from './execution-mode.service';
import { PaperExecutionApiService } from './paper-execution-api.service';
import { RealTimeExecutionService } from './real-time-execution/real-time-execution.service';
import { ResearchModeService } from './research-mode.service';
import { ExecutionFeedItem } from './real-time-execution/real-time-execution.models';

const BLOCKED_REGIME = /EXHAUSTION|FAILED|DEGRADING/i;
const QUALIFIED_REGIME =
  /EXPANSION|PERSISTENCE|PULLBACK|VWAP|COMPRESSION|EXTENSION|CONTINUATION|ACCEPTANCE/i;
const QUALIFIED_MATURITY = new Set(['CONFIRMING', 'CONFIRMED', 'EXTENDED']);

/**
 * Phase 181 — broad paper probe coverage from execution feed (no selection bias).
 * Lightweight: debounced, does not rebuild replay or rescore.
 */
@Injectable({ providedIn: 'root' })
export class PaperExecutionResearchHookService {
  private feedSub: Subscription | null = null;
  private readonly recentKeys = new Map<string, number>();
  private readonly dedupeMs = 30 * 60 * 1000;
  private readonly prefix =
    (environment as { storagePrefix?: string }).storagePrefix + 'paper-probe-';

  constructor(
    private modeService: ExecutionModeService,
    private api: PaperExecutionApiService,
    private rtExecution: RealTimeExecutionService,
    private researchMode: ResearchModeService
  ) {}

  connect(): void {
    if (this.feedSub || !this.modeService.researchInfrastructureEnabled) return;
    if (this.researchMode.isResearch()) return;
    this.feedSub = this.rtExecution.feed$
      .pipe(
        filter(() => this.modeService.isPaperResearch),
        debounceTime(4_000)
      )
      .subscribe(snap => {
        if (!snap?.feed.length || !this.modeService.isPaperResearch) return;
        for (const item of snap.feed.slice(0, 16)) {
          this.maybeProbe(item);
        }
      });
  }

  disconnect(): void {
    this.feedSub?.unsubscribe();
    this.feedSub = null;
  }

  private maybeProbe(item: ExecutionFeedItem): void {
    if (!QUALIFIED_MATURITY.has(item.maturityState)) return;
    if (!QUALIFIED_REGIME.test(item.opportunityType)) return;
    if (BLOCKED_REGIME.test(item.opportunityType)) return;
    const key = `${item.symbol}:${item.opportunityType}`;
    const now = Date.now();
    const last = this.recentKeys.get(key) ?? this.loadDedupe(key);
    if (last && now - last < this.dedupeMs) return;
    this.recentKeys.set(key, now);
    this.saveDedupe(key, now);
    const req: PaperProbeRequest = {
      symbol: item.symbol,
      regime: item.opportunityType,
      planSource: 'FEED',
      entryPrice: item.executionPlan?.entryZone?.ideal ?? undefined,
      convictionScore: Math.round(item.conviction),
      dominanceScore: Math.round(item.triggerIntegrity),
      executionQuality: Math.round(item.expansionProbability * 100)
    };
    this.api.submitProbe(req).subscribe({ error: () => { /* server dedupe / safety */ } });
  }

  private loadDedupe(key: string): number | undefined {
    try {
      const v = sessionStorage.getItem(this.prefix + key);
      return v ? Number(v) : undefined;
    } catch {
      return undefined;
    }
  }

  private saveDedupe(key: string, ts: number): void {
    try {
      sessionStorage.setItem(this.prefix + key, String(ts));
    } catch {
      /* ignore */
    }
  }
}
