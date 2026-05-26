import { ExecutionQualityPoint, TradeQualityGrade } from '../models/refinement.model';
import { TradingSignal } from '../models/signal.model';
import { computeEntryQuality } from './execution-guidance.util';
import { SetupCandidate } from '../models/execution.model';

export function buildExecutionQualityTimeline(signals: TradingSignal[]): ExecutionQualityPoint[] {
  return [...signals]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(s => {
      const candidate: SetupCandidate = {
        symbol: s.symbol ?? '',
        signalType: s.signalType,
        rankScore: s.rankScore,
        extended: s.extended,
        freshness: s.freshness
      };
      const entry = computeEntryQuality(candidate, s.price, {
        ema9: s.vwap ?? s.price,
        ema20: s.vwap ?? s.price,
        ema50: s.vwap ?? s.price,
        rsi: s.rsi ?? 50,
        macd: s.macd ?? 0,
        signalLine: s.macd ?? 0,
        vwap: s.vwap ?? s.price,
        avgVolume: 0,
        relativeVolume: s.relativeVolume ?? 0
      });
      return {
        timestamp: s.timestamp,
        label: phaseLabel(s, entry),
        score: s.rankScore ?? s.confidenceScore ?? 50,
        grade: entry
      };
    });
}

function phaseLabel(s: TradingSignal, entry: string): string {
  if (s.lifecycleState === 'WEAKENING') return 'WEAKENING';
  if (s.extended) return 'EXTENDED';
  if (entry === 'EARLY' || entry === 'GOOD') return 'STRONG';
  if (s.signalType.includes('READY') || s.signalType.includes('SCOUT')) return 'BUILDING';
  if (entry === 'LATE' || entry === 'CHASING') return 'PEAKING';
  return 'BUILDING';
}

export function rrColorClass(quality?: string | null): string {
  if (quality === 'STRONG') return 'rr-strong';
  if (quality === 'MEDIOCRE') return 'rr-mediocre';
  return 'rr-poor';
}

export function tradeGradeClass(grade?: TradeQualityGrade | string | null): string {
  if (!grade) return '';
  return `grade-${grade.toLowerCase().replace('+', '-plus')}`;
}
