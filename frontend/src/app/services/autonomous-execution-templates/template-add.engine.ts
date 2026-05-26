import { Injectable } from '@angular/core';
import { AutonomousTemplateContext, TemplateAddResult, TemplateEntryResult } from './autonomous-template.models';
import { RegimeTemplateDefinition } from './autonomous-template.models';
import { CanonicalExecutionRegime } from '../cluster-family-intelligence/cluster-family.models';
import { persistenceContinuationOverride } from './template-calibration.util';

@Injectable({ providedIn: 'root' })
export class TemplateAddEngine {
  compute(
    ctx: AutonomousTemplateContext,
    def: RegimeTemplateDefinition,
    entry: TemplateEntryResult
  ): TemplateAddResult {
    const { price, direction, metrics, lifecycle, regime } = ctx;
    if (!def.allowsEntry || lifecycle === 'FAILED') {
      return { levels: [], labels: [] };
    }
    if (lifecycle === 'EXHAUSTING' && metrics.exhaustionProbability >= 65 && !persistenceContinuationOverride(metrics)) {
      return { levels: [], labels: [] };
    }

    const long = direction === 'LONG';
    const levels: number[] = [];
    const labels: string[] = [];

    const push = (level: number, label: string) => {
      levels.push(round(level));
      labels.push(label);
    };

    addForRegime(regime, long, price, entry, metrics, push);

    const persistOk = metrics.continuationPersistence >= 58 || persistenceContinuationOverride(metrics);
    if (persistOk && regime !== 'EXHAUSTION_DRIFT') {
      push(long ? price * 1.0035 : price * 0.9965, 'Second leg add');
    }
    if (persistenceContinuationOverride(metrics) && (lifecycle === 'CONFIRMED' || lifecycle === 'EXTENDED')) {
      push(long ? price * 1.006 : price * 0.994, 'Persistence extension add');
    }

    return { levels, labels };
  }
}

function addForRegime(
  regime: CanonicalExecutionRegime,
  long: boolean,
  price: number,
  entry: TemplateEntryResult,
  metrics: AutonomousTemplateContext['metrics'],
  push: (level: number, label: string) => void
): void {
  switch (regime) {
    case 'COMPRESSION_BREAKOUT':
      push(long ? entry.high : entry.low, 'Compression add');
      break;
    case 'SHALLOW_PULLBACK_CONTINUATION':
      push(long ? entry.ideal * 1.0025 : entry.ideal * 0.9975, 'Shallow PB add');
      if (metrics.continuationPersistence >= 55) {
        push(long ? price * 1.004 : price * 0.996, 'Trend continuation add');
      }
      break;
    case 'INSTITUTIONAL_PERSISTENCE':
      push(long ? entry.ideal * 1.0025 : entry.ideal * 0.9975, 'Persistence hold add');
      if (metrics.continuationPersistence >= 60) {
        push(long ? price * 1.005 : price * 0.995, 'Institutional scale add');
      }
      break;
    case 'VWAP_ACCEPTANCE':
      push(entry.ideal, 'VWAP hold add');
      break;
    case 'EARLY_EXPANSION':
      if (metrics.expansionProbability >= 52) {
        push(long ? price * 1.005 : price * 0.995, 'Velocity continuation add');
      }
      if (metrics.relativeVolume >= 1.5) {
        push(long ? price * 1.008 : price * 0.992, 'Momentum second leg');
      }
      break;
    case 'PERSISTENT_CONTINUATION':
      push(long ? price * 1.004 : price * 0.996, 'Persistence add');
      break;
    default:
      break;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
