import { Injectable } from '@angular/core';
import { TradingSignal } from '../../models/signal.model';
import { ExitDecisionOverlay, ExitDecisionType } from './replay-decision-visualization.models';

@Injectable({ providedIn: 'root' })
export class ReplayExitVisualizationEngine {
  buildOverlay(signal: TradingSignal, rrEstimate?: number | null): ExitDecisionOverlay | null {
    const type = this.classify(signal);
    if (!type) return null;
    const rr = rrEstimate ?? this.inferRr(signal, type);
    const rrLabel = rr != null ? `${rr >= 0 ? '+' : ''}${rr.toFixed(1)}R` : null;
    return {
      type,
      compactLabel: this.compact(type, rrLabel, signal),
      markerText: this.markerText(type, rrLabel, signal),
      markerColor: this.color(type),
      rrLabel,
      reason: this.reason(signal, type)
    };
  }

  isExitSignal(signal: TradingSignal): boolean {
    return this.classify(signal) != null;
  }

  private classify(signal: TradingSignal): ExitDecisionType | null {
    if (signal.signalType === 'EXIT' || signal.lifecycleState === 'EXITED') return 'EXIT';
    if (signal.signalType.includes('FAIL') || signal.signalType === 'IMBALANCE_DOWN') return 'BREAKDOWN';
    if (signal.signalType.includes('EXTENDED')) return 'TRAIL';
    return null;
  }

  private markerText(type: ExitDecisionType, rr: string | null, signal: TradingSignal): string {
    switch (type) {
      case 'STOP': return `▼ STOP\n${rr ?? '-1R'}`;
      case 'TARGET': return `🏁 TARGET\n${rr ?? '+2R'}`;
      case 'BREAKDOWN': return `▼ EXIT\nBreakdown`;
      case 'NARRATIVE_FAIL': return `▼ EXIT\nNarrative fail`;
      case 'TRAIL': return `▼ TRAIL\n${rr ?? ''}`.trim();
      case 'EXIT':
      default:
        return `▼ EXIT\n${this.shortReason(signal)}${rr ? `\n${rr}` : ''}`;
    }
  }

  private compact(type: ExitDecisionType, rr: string | null, signal: TradingSignal): string {
    return this.markerText(type, rr, signal).replace('\n', ' · ');
  }

  private reason(signal: TradingSignal, type: ExitDecisionType): string {
    if (signal.signalReason) return signal.signalReason;
    switch (type) {
      case 'BREAKDOWN': return 'Breakdown risk increasing';
      case 'STOP': return 'Stop honored';
      case 'TARGET': return 'Target reached';
      case 'TRAIL': return 'Trail exit';
      default: return 'Exit signal';
    }
  }

  private shortReason(signal: TradingSignal): string {
    if (signal.signalReason?.toLowerCase().includes('breakdown')) return 'Breakdown risk';
    if (signal.signalReason?.toLowerCase().includes('stop')) return 'Stop hit';
    if (signal.signalReason?.toLowerCase().includes('target')) return 'Target hit';
    return 'Exit now';
  }

  private color(type: ExitDecisionType): string {
    switch (type) {
      case 'TARGET': return '#a371f7';
      case 'STOP': return '#ef5350';
      case 'BREAKDOWN': return '#f97316';
      default: return '#8b949e';
    }
  }

  private inferRr(signal: TradingSignal, type: ExitDecisionType): number | null {
    if (type === 'STOP') return -1;
    if (type === 'TARGET') return 2.4;
    const score = signal.confidenceScore;
    if (score != null && type === 'EXIT') return Math.max(-1, Math.min(3, (score - 50) / 20));
    return null;
  }
}
