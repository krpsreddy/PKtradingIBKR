import { Injectable } from '@angular/core';
import {
  OpeningDriveContext,
  OpeningDriveSnapshot,
  OpeningDriveType,
  SignalSnapshot
} from '../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals, pct } from './signal-intelligence.math';
import { FalseBreakoutAnalyticsEngine } from './false-breakout-analytics.engine';

const OPENING_WINDOW_MIN = 15;

@Injectable({ providedIn: 'root' })
export class OpeningDriveAnalyticsService {
  private readonly falseBreakout = new FalseBreakoutAnalyticsEngine();

  /** Historical opening-window profile from stored signals. */
  analyze(signals: SignalSnapshot[]): OpeningDriveSnapshot {
    const opening = signals.filter(s => (s.sessionTimeMinutes ?? 999) < OPENING_WINDOW_MIN);
    const evaluated = evaluatedSignals(opening);

    if (!evaluated.length) {
      return emptyOpeningDrive();
    }

    const exp = computeExpectancyR(opening);
    const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
    const hit1 = evaluated.filter(s => s.evaluation!.hit1R);
    const continuationProb = pct(hit1.length, evaluated.length);
    const fadeProb = pct(evaluated.filter(s => s.evaluation!.status === 'LOSS').length, evaluated.length);

    const falseSnap = this.falseBreakout.analyze(opening);
    const extPct = avgAbsVwap(opening);
    const reclaimWins = evaluated.filter(s => s.signalType === 'VWAP_RECLAIM' && s.evaluation!.status === 'WIN');
    const trendWins = evaluated.filter(s => s.signalType === 'TREND_CONTINUATION' && s.evaluation!.status === 'WIN');

    const type = classifyType({
      exp,
      continuationProb,
      fadeProb,
      falseRate: falseSnap.falseBreakoutRate,
      trapRisk: falseSnap.trapRisk,
      extPct,
      reclaimRate: pct(reclaimWins.length, evaluated.filter(s => s.signalType === 'VWAP_RECLAIM').length),
      trendAcceptRate: pct(trendWins.length, evaluated.filter(s => s.signalType === 'TREND_CONTINUATION').length),
      avgRvol: avgRvol(opening)
    });

    return {
      openingDriveType: type,
      continuationProbability: continuationProb,
      fadeProbability: fadeProb,
      firstPullbackQuality: pullbackQuality(evaluated),
      label: openingLabel(type),
      sampleCount: evaluated.length,
      openingWindowMinutes: OPENING_WINDOW_MIN
    };
  }

  analyzeSymbol(signals: SignalSnapshot[], symbol: string): OpeningDriveSnapshot {
    return this.analyze(signals.filter(s => s.symbol === symbol.toUpperCase()));
  }

  /** Live execution context — first 15 minutes after open. */
  classifyLive(ctx: OpeningDriveContext, historical: OpeningDriveSnapshot): OpeningDriveSnapshot {
    const mins = ctx.sessionTimeMinutes ?? 999;
    if (mins >= OPENING_WINDOW_MIN) {
      return { ...historical, label: historical.label };
    }

    const ext = Math.abs((ctx.vwapDistance ?? 0) * 100);
    const rvol = ctx.rvol ?? 1;
    const regime = (ctx.marketRegime ?? '').toUpperCase();
    const type = ctx.signalType?.toUpperCase() ?? '';

    let driveType: OpeningDriveType = historical.openingDriveType;

    if (historical.fadeProbability > 55 && ext > 4) {
      driveType = 'LIKELY_GAP_FADE';
    } else if (historical.continuationProbability > 60 && rvol > 2.5 && regime.includes('TREND')) {
      driveType = 'OPEN_DRIVE_STRONG';
    } else if (type.includes('VWAP') || type.includes('RECLAIM')) {
      driveType = 'OPENING_RECLAIM';
    } else if (historical.continuationProbability < 45 && rvol > 3) {
      driveType = 'HIGH_OPENING_TRAP_RISK';
    } else if (mins >= 8 && mins < 15 && historical.continuationProbability > 50) {
      driveType = 'WAIT_FIRST_PULLBACK';
    }

    return {
      ...historical,
      openingDriveType: driveType,
      label: openingLabel(driveType)
    };
  }
}

function emptyOpeningDrive(): OpeningDriveSnapshot {
  return {
    openingDriveType: 'NEUTRAL',
    continuationProbability: 0,
    fadeProbability: 0,
    firstPullbackQuality: 0,
    label: 'NEUTRAL OPEN',
    sampleCount: 0,
    openingWindowMinutes: OPENING_WINDOW_MIN
  };
}

function avgAbsVwap(signals: SignalSnapshot[]): number {
  if (!signals.length) return 0;
  const sum = signals.reduce((a, s) => a + Math.abs(s.vwapDistance ?? 0) * 100, 0);
  return sum / signals.length;
}

function avgRvol(signals: SignalSnapshot[]): number {
  if (!signals.length) return 0;
  return signals.reduce((a, s) => a + (s.rvol ?? 0), 0) / signals.length;
}

function pullbackQuality(evaluated: SignalSnapshot[]): number {
  const ideal = evaluated.filter(s => s.captureStage === 'TRIGGERED' || s.captureStage === 'READY');
  if (!ideal.length) return 50;
  const wins = ideal.filter(s => s.evaluation!.status === 'WIN');
  return pct(wins.length, ideal.length);
}

interface ClassifyInput {
  exp: number;
  continuationProb: number;
  fadeProb: number;
  falseRate: number;
  trapRisk: string;
  extPct: number;
  reclaimRate: number;
  trendAcceptRate: number;
  avgRvol: number;
}

function classifyType(input: ClassifyInput): OpeningDriveType {
  if (input.trapRisk === 'HIGH' || input.falseRate > 50) return 'HIGH_OPENING_TRAP_RISK';
  if (input.fadeProb > 55 && input.extPct > 3) return 'LIKELY_GAP_FADE';
  if (input.continuationProb > 62 && input.exp > 0.12 && input.avgRvol > 2) return 'OPEN_DRIVE_STRONG';
  if (input.reclaimRate > 55) return 'OPENING_RECLAIM';
  if (input.falseRate > 40 && input.avgRvol > 3.5) return 'LIQUIDITY_SWEEP';
  if (input.trendAcceptRate > 58) return 'TREND_ACCEPTANCE';
  if (input.trendAcceptRate < 35 && input.fadeProb > 45) return 'TREND_REJECTION';
  if (input.continuationProb > 48 && input.continuationProb < 62) return 'WAIT_FIRST_PULLBACK';
  return 'NEUTRAL';
}

function openingLabel(type: OpeningDriveType): string {
  switch (type) {
    case 'OPEN_DRIVE_STRONG': return 'OPEN DRIVE STRONG';
    case 'WAIT_FIRST_PULLBACK': return 'WAIT FIRST PULLBACK';
    case 'LIKELY_GAP_FADE': return 'LIKELY GAP FADE';
    case 'HIGH_OPENING_TRAP_RISK': return 'HIGH OPENING TRAP RISK';
    case 'OPENING_RECLAIM': return 'OPENING RECLAIM';
    case 'LIQUIDITY_SWEEP': return 'LIQUIDITY SWEEP';
    case 'TREND_ACCEPTANCE': return 'TREND ACCEPTANCE';
    case 'TREND_REJECTION': return 'TREND REJECTION';
    default: return 'NEUTRAL OPEN';
  }
}
