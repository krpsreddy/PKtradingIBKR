import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  SYMBOL_EDGE_PROFILES_STORAGE_KEY,
  SymbolAnalysisStatus,
  SymbolEdgeAnalysisResponse,
  SymbolEdgeCompressedSummary,
  SymbolEdgeProfile,
  SymbolEdgeRankingRow
} from '../models/symbol-edge.models';
import { computeEdgeScore } from '../symbol-edge-score.engine';
import { deriveSymbolPersonality } from '../symbol-personality.engine';

@Injectable({ providedIn: 'root' })
export class SymbolEdgeProfileStore {
  private readonly profiles = new Map<string, SymbolEdgeProfile>();
  private readonly revisionSubject = new BehaviorSubject<number>(0);

  readonly revision$ = this.revisionSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  revision(): number {
    return this.revisionSubject.value;
  }

  get(symbol: string): SymbolEdgeProfile | undefined {
    return this.profiles.get(symbol.toUpperCase());
  }

  all(): SymbolEdgeProfile[] {
    return [...this.profiles.values()].sort((a, b) => b.edgeScore - a.edgeScore);
  }

  getRankings(): SymbolEdgeRankingRow[] {
    return this.all().map(p => ({
      symbol: p.symbol,
      winRate: p.deterministic.overall.winRate,
      expectancy: p.deterministic.overall.expectancy,
      bestSetup: p.deterministic.bestSetup?.type ?? '—',
      worstRegime: p.deterministic.worstRegime?.name ?? '—',
      edgeScore: p.edgeScore,
      sampleCount: p.sampleCount,
      personality: p.personality,
      lastUpdated: p.lastUpdated,
      status: p.status
    }));
  }

  updateStatus(symbol: string, status: SymbolAnalysisStatus, message?: string, error?: string): void {
    const sym = symbol.toUpperCase();
    const existing = this.profiles.get(sym);
    const base = existing ?? this.emptyProfile(sym);
    this.profiles.set(sym, {
      ...base,
      status,
      statusMessage: message,
      error: error ?? (status === 'FAILED' ? base.error : undefined)
    });
    this.persist();
    this.revisionSubject.next(this.revisionSubject.value + 1);
  }

  upsertFromAnalysis(
    symbol: string,
    deterministic: SymbolEdgeCompressedSummary,
    analysis: SymbolEdgeAnalysisResponse | null,
    analysisDigest: string,
    status: SymbolAnalysisStatus = 'READY',
    extras?: Partial<Pick<SymbolEdgeProfile, 'historyLoadedAt' | 'statusMessage' | 'error'>>
  ): SymbolEdgeProfile {
    const sym = symbol.toUpperCase();
    const edgeScore = computeEdgeScore(deterministic);
    const personality = deriveSymbolPersonality(deterministic, analysis?.ai?.summary);

    const profile: SymbolEdgeProfile = {
      symbol: sym,
      lastUpdated: Date.now(),
      sampleCount: deterministic.evaluatedTrades,
      evaluatedTrades: deterministic.evaluatedTrades,
      edgeScore,
      personality,
      deterministic,
      analysis,
      analysisDigest,
      status,
      statusMessage: extras?.statusMessage,
      historyLoadedAt: extras?.historyLoadedAt,
      error: extras?.error
    };

    this.profiles.set(sym, profile);
    this.persist();
    this.revisionSubject.next(this.revisionSubject.value + 1);
    return profile;
  }

  touchDeterministic(
    symbol: string,
    deterministic: SymbolEdgeCompressedSummary,
    extras?: Partial<Pick<SymbolEdgeProfile, 'historyLoadedAt'>>
  ): void {
    const sym = symbol.toUpperCase();
    const existing = this.profiles.get(sym);
    if (existing) {
      this.profiles.set(sym, {
        ...existing,
        deterministic,
        sampleCount: deterministic.evaluatedTrades,
        evaluatedTrades: deterministic.evaluatedTrades,
        edgeScore: computeEdgeScore(deterministic),
        personality: deriveSymbolPersonality(deterministic, existing.analysis?.ai?.summary),
        lastUpdated: Date.now(),
        historyLoadedAt: extras?.historyLoadedAt ?? existing.historyLoadedAt
      });
    } else {
      this.profiles.set(sym, {
        ...this.emptyProfile(sym),
        deterministic,
        sampleCount: deterministic.evaluatedTrades,
        evaluatedTrades: deterministic.evaluatedTrades,
        edgeScore: computeEdgeScore(deterministic),
        personality: deriveSymbolPersonality(deterministic),
        lastUpdated: Date.now()
      });
    }
    this.persist();
    this.revisionSubject.next(this.revisionSubject.value + 1);
  }

  private emptyProfile(symbol: string): SymbolEdgeProfile {
    return {
      symbol: symbol.toUpperCase(),
      lastUpdated: 0,
      sampleCount: 0,
      evaluatedTrades: 0,
      edgeScore: 0,
      personality: 'No analysis yet',
      deterministic: {
        symbol: symbol.toUpperCase(),
        lookbackDays: 60,
        evaluatedTrades: 0,
        overall: {
          trades: 0, winRate: 0, expectancy: 0, avgMfe: 0, avgMae: 0,
          hit1RRate: 0, hit2RRate: 0, confidence: 'LOW'
        },
        bestSetup: null,
        worstSetup: null,
        bestRegime: null,
        worstRegime: null,
        bestTimeWindow: '—',
        lateEntryPenalty: { idealExpectancy: 0, lateExpectancy: 0, expectancyDropPct: 0 },
        premarketExtension: {},
        bySetup: [],
        byRegime: [],
        byEntryQuality: [],
        byRvol: [],
        byTimeOfDay: []
      },
      analysis: null,
      analysisDigest: '',
      status: 'IDLE'
    };
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SYMBOL_EDGE_PROFILES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { profiles?: Record<string, SymbolEdgeProfile> };
      for (const [sym, profile] of Object.entries(parsed.profiles ?? {})) {
        if (profile?.symbol) {
          this.profiles.set(sym.toUpperCase(), { ...profile, status: profile.status ?? 'READY' });
        }
      }
    } catch {
      // Corrupt storage — start fresh.
    }
  }

  private persist(): void {
    try {
      const profiles: Record<string, SymbolEdgeProfile> = {};
      for (const [sym, profile] of this.profiles) {
        profiles[sym] = profile;
      }
      localStorage.setItem(
        SYMBOL_EDGE_PROFILES_STORAGE_KEY,
        JSON.stringify({ version: 1, profiles, savedAt: Date.now() })
      );
    } catch {
      // Quota exceeded — ignore.
    }
  }
}
