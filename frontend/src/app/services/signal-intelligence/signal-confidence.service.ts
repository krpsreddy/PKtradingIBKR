import { Injectable } from '@angular/core';
import {
  ConfidenceRating,
  IntelligenceSignalType,
  SetupConfidenceRating,
  SignalSnapshot
} from '../../models/signal-intelligence.model';
import { confidenceFromCount, evaluatedSignals, pct } from './signal-intelligence.math';

@Injectable({ providedIn: 'root' })
export class SignalConfidenceService {

  globalConfidence(signals: SignalSnapshot[]): ConfidenceRating {
    return confidenceFromCount(evaluatedSignals(signals).length);
  }

  setupRatings(signals: SignalSnapshot[]): SetupConfidenceRating[] {
    const types: IntelligenceSignalType[] = [
      'BREAKOUT', 'VWAP_RECLAIM', 'TREND_CONTINUATION', 'REVERSAL', 'MOMENTUM'
    ];
    return types
      .map(signalType => {
        const bucket = signals.filter(s => s.signalType === signalType);
        const evaluated = evaluatedSignals(bucket);
        const wins = evaluated.filter(s => s.evaluation!.status === 'WIN');
        return {
          signalType,
          winRate: pct(wins.length, evaluated.length),
          confidence: confidenceFromCount(evaluated.length)
        };
      })
      .filter(r => r.confidence.sampleCount > 0)
      .sort((a, b) => b.winRate - a.winRate);
  }
}
