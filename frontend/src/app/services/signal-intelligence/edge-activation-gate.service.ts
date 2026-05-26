import { Injectable } from '@angular/core';
import {
  EdgeActivationGateSnapshot,
  EdgeGateState,
  FalseBreakoutSnapshot,
  IntelligenceSignalType,
  MarketRegime,
  OpeningDriveSnapshot,
  SetupRegimeMatrixSnapshot,
  SignalSnapshot
} from '../../models/signal-intelligence.model';
import { computeExpectancyR, evaluatedSignals } from './signal-intelligence.math';

const MIN_GLOBAL_SAMPLES = 10;
const MIN_COMBO_SAMPLES = 5;

export interface EdgeGateContext {
  symbol: string;
  signalType?: string | null;
  marketRegime?: string | null;
  regimeAligned?: boolean;
  rvol?: number | null;
  sessionTimeMinutes?: number | null;
  vwapDistance?: number | null;
  trendAlignment?: number | null;
  entryQuality?: string | null;
}

@Injectable({ providedIn: 'root' })
export class EdgeActivationGateService {

  evaluate(
    signals: SignalSnapshot[],
    ctx: EdgeGateContext,
    matrix: SetupRegimeMatrixSnapshot,
    falseBreakout: FalseBreakoutSnapshot,
    openingDrive?: OpeningDriveSnapshot
  ): EdgeActivationGateSnapshot {
    const sym = ctx.symbol.toUpperCase();
    const symbolSignals = signals.filter(s => s.symbol === sym);
    const evaluated = evaluatedSignals(symbolSignals);
    const globalExp = computeExpectancyR(symbolSignals);
    const sampleCount = evaluated.length;

    const setup = normalizeSetup(ctx.signalType);
    const regime = normalizeRegime(ctx.marketRegime);
    const combo = matrix.pivot.find(p => p.setup === setup && p.regime === regime)
      ?? matrix.pivot.find(p => p.setup === setup)
      ?? null;

    const comboExp = combo?.expectancyR ?? globalExp;
    const comboSamples = combo?.sampleCount ?? sampleCount;
    const regimeAligned = ctx.regimeAligned ?? (combo?.edgeTone === 'POSITIVE' || comboExp > 0);
    const fakeoutAcceptable = falseBreakout.trapRisk !== 'HIGH';
    const unstable = matrix.unstableCombinations.some(
      u => u.setup === setup && u.regime === regime
    );
    const setupStable = !unstable && combo?.edgeTone !== 'NEGATIVE';

    const reasons: string[] = [];
    let state: EdgeGateState = 'EDGE_ACTIVE';

    if (sampleCount < MIN_GLOBAL_SAMPLES) {
      state = 'LOW_CONFIDENCE';
      reasons.push(`Fewer than ${MIN_GLOBAL_SAMPLES} evaluated samples`);
    } else if (comboSamples < MIN_COMBO_SAMPLES) {
      state = 'WAIT_FOR_CONFIRMATION';
      reasons.push('Setup×regime combo lacks minimum sample depth');
    } else if (comboExp <= 0) {
      state = 'NO_EDGE';
      reasons.push('Negative or zero expectancy for current setup×regime');
    } else if (!regimeAligned) {
      state = 'OBSERVE_ONLY';
      reasons.push('Regime not aligned with historical edge');
    } else if (!fakeoutAcceptable) {
      state = 'REDUCE_SIZE';
      reasons.push(`Elevated fakeout risk (${falseBreakout.falseBreakoutRate}% false breakout rate)`);
    } else if (!setupStable) {
      state = 'REDUCE_SIZE';
      reasons.push('Setup×regime combination is unstable in matrix');
    } else if (openingDrive?.openingDriveType === 'HIGH_OPENING_TRAP_RISK') {
      state = 'WAIT_FOR_CONFIRMATION';
      reasons.push('High opening trap risk in first 15 minutes');
    } else if (comboExp > 0 && comboExp < 0.08) {
      state = 'OBSERVE_ONLY';
      reasons.push('Marginal positive expectancy — observe for confirmation');
    }

    return {
      state,
      label: gateLabel(state),
      reasons: reasons.length ? reasons : ['Edge criteria met — advisory only'],
      expectancyR: comboExp,
      sampleCount: comboSamples,
      regimeAligned,
      fakeoutAcceptable,
      setupStable,
      advisoryOnly: true
    };
  }
}

function normalizeSetup(raw?: string | null): IntelligenceSignalType {
  const u = (raw ?? 'BREAKOUT').toUpperCase().replace(/\s/g, '_');
  if (u.includes('VWAP') || u.includes('RECLAIM')) return 'VWAP_RECLAIM';
  if (u.includes('TREND') && u.includes('CONT')) return 'TREND_CONTINUATION';
  if (u.includes('REVERSAL')) return 'REVERSAL';
  if (u.includes('MOMENTUM') || u.includes('MOM')) return 'MOMENTUM';
  return 'BREAKOUT';
}

function normalizeRegime(raw?: string | null): MarketRegime {
  const u = (raw ?? 'TREND').toUpperCase();
  if (u.includes('CHOP')) return 'CHOP';
  if (u.includes('BREAK')) return 'BREAKOUT';
  if (u.includes('CALM')) return 'CALM';
  if (u.includes('EXIT')) return 'EXITING';
  return 'TREND';
}

function gateLabel(state: EdgeGateState): string {
  switch (state) {
    case 'EDGE_ACTIVE': return 'EDGE ACTIVE';
    case 'NO_EDGE': return 'NO EDGE';
    case 'OBSERVE_ONLY': return 'OBSERVE ONLY';
    case 'REDUCE_SIZE': return 'REDUCE SIZE';
    case 'LOW_CONFIDENCE': return 'LOW CONFIDENCE';
    case 'WAIT_FOR_CONFIRMATION': return 'WAIT FOR CONFIRMATION';
  }
}
