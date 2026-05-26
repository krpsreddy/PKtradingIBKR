import { Injectable } from '@angular/core';
import {
  AgingAnalyticsSnapshot,
  AgingWindowMetrics,
  EVALUATION_WINDOWS_MINUTES,
  IntelligenceSignalType,
  SetupAgingProfile,
  SignalSnapshot
} from '../../models/signal-intelligence.model';
import { computeExpectancyR, pct } from './signal-intelligence.math';

@Injectable({ providedIn: 'root' })
export class SignalAgingAnalyticsService {

  analyze(signals: SignalSnapshot[]): AgingAnalyticsSnapshot {
    const globalWindows = EVALUATION_WINDOWS_MINUTES.map(w =>
      this.windowMetrics(signals, w)
    );
    const bySetup = this.setupProfiles(signals);
    const strongestEarly = this.findStrongestEarly(bySetup);
    const persistence = this.findPersistenceSetup(bySetup);
    return {
      globalWindows,
      bySetup,
      strongestEarlySetup: strongestEarly,
      persistenceSetup: persistence,
      summaryInsight: this.buildSummary(bySetup, strongestEarly, persistence)
    };
  }

  private setupProfiles(signals: SignalSnapshot[]): SetupAgingProfile[] {
    const types: IntelligenceSignalType[] = [
      'BREAKOUT', 'VWAP_RECLAIM', 'TREND_CONTINUATION', 'REVERSAL', 'MOMENTUM'
    ];
    return types
      .map(signalType => {
        const bucket = signals.filter(s => s.signalType === signalType);
        const windows = EVALUATION_WINDOWS_MINUTES.map(w => this.windowMetrics(bucket, w));
        const peak = this.peakWindow(windows);
        return {
          signalType,
          windows,
          peakWindowMinutes: peak,
          decayNote: this.decayNote(signalType, windows, peak)
        };
      })
      .filter(p => p.windows.some(w => w.sampleCount > 0));
  }

  private windowMetrics(signals: SignalSnapshot[], windowMinutes: number): AgingWindowMetrics {
    const withWindow = signals.filter(s =>
      s.evaluation?.windows?.some(w => w.windowMinutes === windowMinutes)
    );
    const statuses = withWindow.map(s =>
      s.evaluation!.windows!.find(w => w.windowMinutes === windowMinutes)!
    );
    const evaluated = statuses.filter(w => w.status !== 'OPEN');
    const wins = evaluated.filter(w => w.status === 'WIN');
    const losses = evaluated.filter(w => w.status === 'LOSS');

    const pseudoSignals = withWindow.filter(s => {
      const w = s.evaluation!.windows!.find(x => x.windowMinutes === windowMinutes)!;
      return w.status !== 'OPEN';
    });

    return {
      windowMinutes,
      winRate: pct(wins.length, evaluated.length),
      expectancyR: this.expectancyFromWindows(pseudoSignals, windowMinutes),
      hit1RRate: pct(evaluated.filter(w => w.hit1R).length, evaluated.length),
      lossRate: pct(losses.length, evaluated.length),
      sampleCount: evaluated.length
    };
  }

  private expectancyFromWindows(signals: SignalSnapshot[], windowMinutes: number): number {
    if (!signals.length) return 0;
    const rows = signals.map(s => {
      const w = s.evaluation!.windows!.find(x => x.windowMinutes === windowMinutes)!;
      return { status: w.status, mfeR: w.mfeR, maeR: w.maeR };
    });
    const wins = rows.filter(r => r.status === 'WIN');
    const losses = rows.filter(r => r.status === 'LOSS');
    const winRate = pct(wins.length, rows.length);
    const lossRate = pct(losses.length, rows.length);
    const avgWin = wins.length ? wins.reduce((a, b) => a + b.mfeR, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((a, b) => a + Math.abs(b.maeR), 0) / losses.length : 0;
    return Math.round(((winRate / 100) * avgWin - (lossRate / 100) * avgLoss) * 100) / 100;
  }

  private peakWindow(windows: AgingWindowMetrics[]): number | null {
    const eligible = windows.filter(w => w.sampleCount >= 3);
    if (!eligible.length) return null;
    return eligible.reduce((a, b) => a.expectancyR >= b.expectancyR ? a : b).windowMinutes;
  }

  private decayNote(
    signalType: IntelligenceSignalType,
    windows: AgingWindowMetrics[],
    peak: number | null
  ): string | null {
    if (!peak) return null;
    const early = windows.find(w => w.windowMinutes === 5);
    const late = windows.find(w => w.windowMinutes === 60);
    if (!early || !late || early.sampleCount < 3 || late.sampleCount < 3) return null;

    if (peak <= 15 && early.expectancyR > late.expectancyR + 0.15) {
      return `${signalType.replace(/_/g, ' ')} strongest first ${peak}m`;
    }
    if (peak >= 30 && late.winRate > early.winRate + 10) {
      return `${signalType.replace(/_/g, ' ')} persists — peaks ${peak}m`;
    }
    if (late.lossRate > early.lossRate + 15 && peak <= 30) {
      return `${signalType.replace(/_/g, ' ')} failure accelerates after ${peak}m`;
    }
    return null;
  }

  private findStrongestEarly(profiles: SetupAgingProfile[]): IntelligenceSignalType | null {
    const early = profiles.filter(p => p.peakWindowMinutes != null && p.peakWindowMinutes <= 15);
    if (!early.length) return null;
    return early.sort((a, b) => {
      const aExp = a.windows.find(w => w.windowMinutes === a.peakWindowMinutes!)?.expectancyR ?? 0;
      const bExp = b.windows.find(w => w.windowMinutes === b.peakWindowMinutes!)?.expectancyR ?? 0;
      return bExp - aExp;
    })[0]?.signalType ?? null;
  }

  private findPersistenceSetup(profiles: SetupAgingProfile[]): IntelligenceSignalType | null {
    const persistent = profiles.filter(p =>
      p.decayNote?.includes('persists') || (p.peakWindowMinutes != null && p.peakWindowMinutes >= 30)
    );
    return persistent[0]?.signalType ?? null;
  }

  private buildSummary(
    profiles: SetupAgingProfile[],
    early: IntelligenceSignalType | null,
    persistence: IntelligenceSignalType | null
  ): string | null {
    const notes = profiles.map(p => p.decayNote).filter(Boolean);
    if (notes.length) return notes[0]!;
    if (early) return `${early.replace(/_/g, ' ')} strongest early`;
    if (persistence) return `${persistence.replace(/_/g, ' ')} works slower but persists`;
    return null;
  }
}
