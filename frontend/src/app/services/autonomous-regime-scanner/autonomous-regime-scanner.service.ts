import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  ScannerAlert,
  ScannerOpportunityCard,
  ScannerSnapshot
} from './autonomous-regime-scanner.models';
import { IntelligenceOffloadService } from '../intelligence-offload/intelligence-offload.service';
import { IntelligenceSnapshotApiService } from '../intelligence-offload/intelligence-snapshot-api.service';
import { buildScannerCard } from './scanner-ranking.engine';
import { applyConvictionScores } from './scanner-conviction.engine';
import { bucketBySection, topOpportunities } from './scanner-prioritization.engine';
import { ScannerSymbolStateEngine } from './scanner-symbol-state.engine';
import { buildAlerts, detectRisingCards } from './scanner-alert.engine';
import { cacheValid, SCANNER_CACHE_TTL_MS, shouldRescan } from './scanner-persistence.engine';
import { ClusterFamilyRegistryService } from '../cluster-family-intelligence/cluster-family-registry.service';

/** Phase 165 — real-time autonomous regime scanner (backend snapshots only). */
@Injectable({ providedIn: 'root' })
export class AutonomousRegimeScannerService {
  private readonly symbolState = new ScannerSymbolStateEngine();
  private lastScanAt = 0;
  private cached: ScannerSnapshot | null = null;
  private scanning = false;

  private readonly snapshotSubject = new BehaviorSubject<ScannerSnapshot | null>(null);
  private readonly alertsSubject = new BehaviorSubject<ScannerAlert[]>([]);

  readonly snapshot$ = this.snapshotSubject.asObservable();
  readonly alerts$ = this.alertsSubject.asObservable();

  constructor(
    private offload: IntelligenceOffloadService,
    private api: IntelligenceSnapshotApiService,
    private clusterFamilies: ClusterFamilyRegistryService
  ) {}

  private rankWithFamilyBoost(cards: ScannerOpportunityCard[]): ScannerOpportunityCard[] {
    return applyConvictionScores(cards, t => this.clusterFamilies.scannerBoostForOpportunityType(t));
  }

  snapshot(): ScannerSnapshot | null {
    return this.snapshotSubject.value;
  }

  topCards(limit = 5): ScannerOpportunityCard[] {
    return (this.snapshotSubject.value?.topOpportunities ?? []).slice(0, limit);
  }

  cardForSymbol(symbol: string): ScannerOpportunityCard | null {
    const sym = symbol.toUpperCase();
    return this.snapshotSubject.value?.topOpportunities.find(c => c.symbol === sym) ?? null;
  }

  /** Scan all active symbols — uses backend snapshots, cached 30s. */
  scan(symbols: string[], force = false): Observable<ScannerSnapshot> {
    const uniq = [...new Set(symbols.map(s => s.toUpperCase()).filter(Boolean))];
    if (!uniq.length) {
      const empty = this.emptySnapshot();
      this.snapshotSubject.next(empty);
      return of(empty);
    }

    if (!force && this.cached && cacheValid(this.cached.generatedAt) && !shouldRescan(this.lastScanAt)) {
      return of(this.cached);
    }
    if (this.scanning && this.cached) {
      return of(this.cached);
    }

    this.scanning = true;
    return this.fetchScannerSnapshot(uniq).pipe(
      tap(snap => {
        this.cached = snap;
        this.lastScanAt = Date.now();
        this.scanning = false;
        this.snapshotSubject.next(snap);
        this.alertsSubject.next(buildAlerts(snap.topOpportunities, this.symbolStateMap()));
      }),
      catchError(() => {
        this.scanning = false;
        const fallback = this.cached ?? this.emptySnapshot();
        this.snapshotSubject.next(fallback);
        return of(fallback);
      })
    );
  }

  /** Phase 187 — realtime-first full snapshot; subset filter client-side. */
  private fetchScannerSnapshot(symbols: string[]): Observable<ScannerSnapshot> {
    const useFull = symbols.length > 25;
    const source$ = useFull
      ? this.api.liveScannerSnapshot()
      : this.api.scannerOpportunities(symbols, undefined, 'live');

    return source$.pipe(
      map(dto => this.mapBackendSnapshot(this.filterDto(dto, symbols))),
      catchError(() => this.fetchPerSymbol(symbols))
    );
  }

  private filterDto(
    dto: import('../intelligence-offload/intelligence-snapshot-api.service').ScannerSnapshotDto,
    symbols: string[]
  ): import('../intelligence-offload/intelligence-snapshot-api.service').ScannerSnapshotDto {
    const want = new Set(symbols.map(s => s.toUpperCase()));
    if (want.size === 0 || (dto.opportunities?.length ?? 0) <= want.size) {
      return dto;
    }
    return {
      ...dto,
      opportunities: dto.opportunities.filter(o => want.has(o.symbol))
    };
  }

  private fetchPerSymbol(symbols: string[]): Observable<ScannerSnapshot> {
    const requests = symbols.map(sym =>
      forkJoin({
        sym: of(sym),
        cards: this.offload.fetchExecutionCards(sym),
        regime: this.offload.fetchLiveRegime(sym)
      })
    );
    return forkJoin(requests).pipe(
      map(results => {
        const inputs = results.flatMap(r => {
          const topCard = r.cards.cards[0];
          const regime = r.regime.activeContinuationRegimes.find(x => x.symbol === r.sym)
            ?? r.regime.activeContinuationRegimes[0];
          if (topCard) {
            return [buildScannerCard({
              symbol: r.sym,
              card: topCard,
              regimeType: regime?.regimeType,
              classification: regime?.classification,
              continuationPersistence: regime?.continuationPersistenceScore,
              expansionProbability: topCard.expansionProbability
            }, 0)];
          }
          if (regime) {
            return [buildScannerCard({
              symbol: r.sym,
              regimeType: regime.regimeType,
              classification: regime.classification,
              continuationPersistence: regime.continuationPersistenceScore,
              expansionProbability: regime.expansionProbability
            }, 0)];
          }
          return [];
        });
        return this.composeSnapshot(symbols, this.rankWithFamilyBoost(inputs));
      })
    );
  }

  private mapBackendSnapshot(dto: import('../intelligence-offload/intelligence-snapshot-api.service').ScannerSnapshotDto): ScannerSnapshot {
    const cards: ScannerOpportunityCard[] = dto.opportunities.map((o, i) => ({
      symbol: o.symbol,
      opportunityType: o.opportunityType as ScannerOpportunityCard['opportunityType'],
      action: o.action as ScannerOpportunityCard['action'],
      tone: o.tone as ScannerOpportunityCard['tone'],
      badge: o.badge,
      convictionScore: o.convictionScore,
      expansionProbability: o.expansionProbability,
      continuationPersistence: o.continuationPersistence,
      triggerIntegrity: o.triggerIntegrity,
      institutionalPressure: o.institutionalPressure,
      exhaustionProbability: o.exhaustionProbability,
      executionQuality: o.executionQuality,
      entryZoneLabel: o.entryZoneLabel,
      riskLabel: o.riskLabel,
      whyNow: o.whyNow,
      windowLabel: o.windowLabel,
      rvolLabel: o.rvolLabel,
      popVelocity: 0,
      isRising: false,
      rank: i + 1
    }));

    const ranked = this.applyStateAndRising(this.rankWithFamilyBoost(cards));
    return this.buildSnapshotFromCards(dto.symbols?.length ?? ranked.length, ranked, dto.summaryInsights);
  }

  private composeSnapshot(symbols: string[], ranked: ScannerOpportunityCard[]): ScannerSnapshot {
    const withState = this.applyStateAndRising(ranked);
    return this.buildSnapshotFromCards(symbols.length, withState, [
      `${withState.length} autonomous opportunities ranked`,
      'Backend snapshot pipeline · no browser rescoring',
      'Advisory only'
    ]);
  }

  private applyStateAndRising(cards: ScannerOpportunityCard[]): ScannerOpportunityCard[] {
    for (const c of cards) {
      this.symbolState.update(c.symbol, c.convictionScore);
    }
    const stateMap = this.symbolStateMap();
    return detectRisingCards(cards, stateMap);
  }

  private buildSnapshotFromCards(symbolCount: number, cards: ScannerOpportunityCard[], insights: string[]): ScannerSnapshot {
    const buckets = bucketBySection(cards);
    return {
      advisoryOnly: true,
      generatedAt: Date.now(),
      symbolCount,
      topOpportunities: topOpportunities(cards),
      highContinuation: buckets.HIGH_CONTINUATION.slice(0, 8),
      earlyExpansion: buckets.EARLY_EXPANSION.slice(0, 8),
      institutionalPersistence: buckets.INSTITUTIONAL_PERSISTENCE.slice(0, 8),
      healthyPullback: buckets.HEALTHY_PULLBACK.slice(0, 8),
      compressionBreakout: buckets.COMPRESSION_BREAKOUT.slice(0, 8),
      exhaustionAvoid: buckets.EXHAUSTION_AVOID.slice(0, 8),
      risingSymbols: cards.filter(c => c.isRising).map(c => c.symbol),
      summaryInsights: insights
    };
  }

  private symbolStateMap(): Map<string, import('./autonomous-regime-scanner.models').SymbolScannerState> {
    const m = new Map<string, import('./autonomous-regime-scanner.models').SymbolScannerState>();
    for (const c of this.snapshotSubject.value?.topOpportunities ?? []) {
      const st = this.symbolState.get(c.symbol);
      if (st) m.set(c.symbol, st);
    }
    return m;
  }

  private emptySnapshot(): ScannerSnapshot {
    return this.buildSnapshotFromCards(0, [], ['No symbols to scan — add watchlist symbols']);
  }

  invalidate(): void {
    this.cached = null;
    this.lastScanAt = 0;
    this.symbolState.clear();
  }
}
