import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TradingSymbol } from '../../models/trading-symbol.model';
import { evaluateNanoScan, NanoScanResult } from '../real-time-execution/nano-scanner.engine';
import { DashboardStateStoreService } from '../dashboard/dashboard-state-store.service';

/** Phase 178 — Tier-1 lightweight nano pulse (no HTTP, no plan rebuild). */
@Injectable({ providedIn: 'root' })
export class NanoPulseService {
  private readonly boostsSubject = new BehaviorSubject<Map<string, NanoScanResult>>(new Map());
  readonly boosts$ = this.boostsSubject.asObservable();

  constructor(private store: DashboardStateStoreService) {}

  /** Client-only nano evaluation from watchlist snapshot fields. */
  tick(symbols: TradingSymbol[]): Map<string, NanoScanResult> {
    const boosts = new Map<string, NanoScanResult>();
    const enabled = symbols.filter(s => s.enabled && s.scanEnabled !== false);
    for (const sym of enabled) {
      const spark = sym.sparkline ?? [];
      const priceDelta = spark.length >= 2
        ? ((spark[spark.length - 1] - spark[spark.length - 2]) / Math.max(spark[spark.length - 2], 0.01)) * 100
        : 0;
      const rvol = sym.relativeVolume ?? 1;
      const result = evaluateNanoScan({
        symbol: sym.symbol,
        priceDelta,
        rvolAcceleration: Math.max(0, (rvol - 1) * 40),
        vwapReclaim: (sym.trend ?? '').toLowerCase().includes('above') || sym.trendIcon === '▲',
        microCompression: sym.mtfAlignmentScore ?? 30,
        spreadTightening: sym.highRvol ? 40 : 15,
        continuationVelocity: (sym.confidenceScore ?? 40) * 0.6,
        tapeImbalance: sym.momentumState === 'HOT' ? 35 : 10,
        persistenceTimer: Math.min(30, Math.round((sym.confidenceScore ?? 30) / 4)),
        pullbackDepth: sym.extended ? 25 : 8
      });
      boosts.set(sym.symbol, result);
    }
    this.boostsSubject.next(boosts);
    this.store.patchNanoBoosts(boosts);
    return boosts;
  }

  snapshot(): Map<string, NanoScanResult> {
    return this.boostsSubject.value;
  }
}
